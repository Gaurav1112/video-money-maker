#!/usr/bin/env python3
"""
Lip Sync Generator — Photo + Audio → Talking Face Video

Takes a face photo (JPG/PNG) and audio file (WAV/MP3) and generates
a video of the face speaking synced to the audio.

Pipeline:
  1. Rhubarb Lip Sync — analyzes audio → mouth shape cues (A-X) with timestamps
  2. MediaPipe FaceLandmarker — detects face/mouth landmarks in the photo
  3. OpenCV — renders animated mouth frames synced to cues
  4. ffmpeg — muxes video + audio into final MP4

Requirements:
  pip install mediapipe opencv-contrib-python numpy pillow pydub

  Plus: Rhubarb Lip Sync binary (auto-downloaded on first run)
  Download: https://github.com/DanielSWolf/rhubarb-lip-sync/releases

Usage:
  python3 scripts/lip-sync.py --face photo.jpg --audio speech.wav --output talking.mp4
  python3 scripts/lip-sync.py --face photo.jpg --audio speech.wav --output talking.mp4 --fps 30 --quality high
  python3 scripts/lip-sync.py --face photo.jpg --audio speech.wav --output talking.mp4 --mode overlay

Modes:
  full    — renders complete video with animated face (default)
  overlay — renders ONLY the mouth animation on transparent background (for Remotion compositing)
  cues    — outputs only the JSON mouth cues (no video rendering)
"""

import argparse
import json
import math
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

# ============================================================================
# CONFIGURATION
# ============================================================================

RHUBARB_VERSION = "1.13.0"
RHUBARB_DIR = Path(__file__).parent.parent / "tools" / "rhubarb"
MEDIAPIPE_MODEL_PATH = Path(__file__).parent.parent / "tools" / "face_landmarker.task"
MEDIAPIPE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

# Mouth shape openness mapping (Rhubarb Preston Blair shapes)
# X = silence, A = closed (M/B/P), B-F = various openness, G/H = extended
MOUTH_SHAPES = {
    'X': {'openness': 0.0,  'width': 1.0,  'roundness': 0.0, 'desc': 'silence/rest'},
    'A': {'openness': 0.02, 'width': 1.0,  'roundness': 0.0, 'desc': 'M, B, P - closed'},
    'B': {'openness': 0.25, 'width': 0.85, 'roundness': 0.2, 'desc': 'K, S, T - slightly open'},
    'C': {'openness': 0.55, 'width': 0.9,  'roundness': 0.3, 'desc': 'EH, AE - medium open'},
    'D': {'openness': 0.75, 'width': 1.0,  'roundness': 0.4, 'desc': 'AI, AH - wide open'},
    'E': {'openness': 0.55, 'width': 0.7,  'roundness': 0.8, 'desc': 'O - rounded'},
    'F': {'openness': 0.35, 'width': 0.55, 'roundness': 0.9, 'desc': 'OO, UU - small rounded'},
    'G': {'openness': 0.4,  'width': 0.85, 'roundness': 0.2, 'desc': 'F, V - teeth on lip'},
    'H': {'openness': 0.2,  'width': 0.8,  'roundness': 0.1, 'desc': 'L - tongue visible'},
}


# ============================================================================
# TOOL SETUP
# ============================================================================

def ensure_rhubarb() -> Path:
    """Download and cache Rhubarb Lip Sync binary if not present."""
    rhubarb_bin = RHUBARB_DIR / f"Rhubarb-Lip-Sync-{RHUBARB_VERSION}-macOS" / "rhubarb"

    if rhubarb_bin.exists():
        return rhubarb_bin

    print(f"Downloading Rhubarb Lip Sync v{RHUBARB_VERSION}...")
    RHUBARB_DIR.mkdir(parents=True, exist_ok=True)

    system = platform.system()
    if system == "Darwin":
        platform_name = "macOS"
    elif system == "Linux":
        platform_name = "Linux"
    elif system == "Windows":
        platform_name = "Windows"
    else:
        raise RuntimeError(f"Unsupported platform: {system}")

    url = f"https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v{RHUBARB_VERSION}/Rhubarb-Lip-Sync-{RHUBARB_VERSION}-{platform_name}.zip"
    zip_path = RHUBARB_DIR / "rhubarb.zip"

    urllib.request.urlretrieve(url, zip_path)
    with zipfile.ZipFile(zip_path, 'r') as zf:
        zf.extractall(RHUBARB_DIR)
    zip_path.unlink()

    # Make binary executable
    rhubarb_bin.chmod(0o755)
    print(f"Rhubarb installed at: {rhubarb_bin}")
    return rhubarb_bin


def ensure_mediapipe_model() -> Path:
    """Download MediaPipe face landmarker model if not present."""
    if MEDIAPIPE_MODEL_PATH.exists():
        return MEDIAPIPE_MODEL_PATH

    print("Downloading MediaPipe face landmarker model...")
    MEDIAPIPE_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(MEDIAPIPE_MODEL_URL, MEDIAPIPE_MODEL_PATH)
    print(f"Model saved at: {MEDIAPIPE_MODEL_PATH}")
    return MEDIAPIPE_MODEL_PATH


# ============================================================================
# STEP 1: AUDIO ANALYSIS (Rhubarb)
# ============================================================================

def get_mouth_cues(audio_path: str, rhubarb_bin: Path, dialogue: str = None) -> dict:
    """Run Rhubarb to get mouth shape cues from audio."""
    # Convert to WAV if needed (Rhubarb only accepts WAV/OGG)
    wav_path = audio_path
    temp_wav = None

    if not audio_path.lower().endswith(('.wav', '.ogg')):
        temp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        temp_wav.close()
        subprocess.run(
            ['ffmpeg', '-y', '-i', audio_path, '-ar', '44100', '-ac', '1', temp_wav.name],
            capture_output=True, check=True
        )
        wav_path = temp_wav.name

    cmd = [str(rhubarb_bin), '-f', 'json', wav_path]

    # If dialogue text is provided, Rhubarb can use it for better recognition
    if dialogue:
        dialog_file = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
        dialog_file.write(dialogue)
        dialog_file.close()
        cmd.extend(['-d', dialog_file.name])

    result = subprocess.run(cmd, capture_output=True, text=True)

    # Clean up temp files
    if temp_wav:
        os.unlink(temp_wav.name)
    if dialogue:
        os.unlink(dialog_file.name)

    if result.returncode != 0:
        raise RuntimeError(f"Rhubarb failed: {result.stderr}")

    # Extract JSON (skip progress output)
    output = result.stdout
    json_start = output.index('{')
    return json.loads(output[json_start:])


# ============================================================================
# STEP 2: FACE DETECTION (MediaPipe)
# ============================================================================

def detect_face_landmarks(image_path: str, model_path: Path) -> dict:
    """Detect face and mouth landmarks using MediaPipe."""
    import mediapipe as mp
    from mediapipe.tasks.python import vision, BaseOptions

    options = vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(model_path)),
        output_face_blendshapes=True,
        num_faces=1
    )
    landmarker = vision.FaceLandmarker.create_from_options(options)

    mp_image = mp.Image.create_from_file(image_path)
    result = landmarker.detect(mp_image)
    landmarker.close()

    img = cv2.imread(image_path)
    h, w = img.shape[:2]

    if not result.face_landmarks:
        print("WARNING: No face detected. Using center-of-image fallback.")
        return {
            'detected': False,
            'image_size': (w, h),
            'mouth_center': (w // 2, int(h * 0.65)),
            'mouth_width': int(w * 0.15),
            'mouth_height': int(h * 0.04),
            'face_bbox': None,
            'landmarks': None,
            'chin': (w // 2, int(h * 0.75)),
            'nose_tip': (w // 2, int(h * 0.55)),
        }

    lm = result.face_landmarks[0]

    # Key mouth landmarks (MediaPipe face mesh indices)
    upper_lip_center = lm[13]
    lower_lip_center = lm[14]
    mouth_left = lm[61]
    mouth_right = lm[291]
    upper_lip_top = lm[0]   # Top of upper lip
    lower_lip_bottom = lm[17]  # Bottom of lower lip

    # Additional landmarks for natural animation
    chin = lm[152]
    nose_tip = lm[1]
    left_eye = lm[33]
    right_eye = lm[263]
    forehead = lm[10]

    # Get mouth outer contour landmarks for masking
    # Upper lip outer: 61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291
    # Lower lip outer: 61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291
    upper_lip_indices = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]
    lower_lip_indices = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291]

    upper_lip_pts = [(int(lm[i].x * w), int(lm[i].y * h)) for i in upper_lip_indices]
    lower_lip_pts = [(int(lm[i].x * w), int(lm[i].y * h)) for i in lower_lip_indices]

    mouth_center_x = int((mouth_left.x + mouth_right.x) / 2 * w)
    mouth_center_y = int((upper_lip_center.y + lower_lip_center.y) / 2 * h)
    mouth_w = int(abs(mouth_right.x - mouth_left.x) * w)
    mouth_h = int(abs(lower_lip_bottom.y - upper_lip_top.y) * h)

    # Face bounding box from landmarks
    all_x = [lm[i].x * w for i in range(468)]
    all_y = [lm[i].y * h for i in range(468)]
    face_bbox = (int(min(all_x)), int(min(all_y)), int(max(all_x)), int(max(all_y)))

    return {
        'detected': True,
        'image_size': (w, h),
        'mouth_center': (mouth_center_x, mouth_center_y),
        'mouth_width': mouth_w,
        'mouth_height': mouth_h,
        'upper_lip_pts': upper_lip_pts,
        'lower_lip_pts': lower_lip_pts,
        'face_bbox': face_bbox,
        'chin': (int(chin.x * w), int(chin.y * h)),
        'nose_tip': (int(nose_tip.x * w), int(nose_tip.y * h)),
        'left_eye': (int(left_eye.x * w), int(left_eye.y * h)),
        'right_eye': (int(right_eye.x * w), int(right_eye.y * h)),
        'forehead': (int(forehead.x * w), int(forehead.y * h)),
    }


# ============================================================================
# STEP 3: MOUTH RENDERING
# ============================================================================

def interpolate_shape(shape_a: dict, shape_b: dict, t: float) -> dict:
    """Smoothly interpolate between two mouth shapes."""
    return {
        'openness': shape_a['openness'] * (1 - t) + shape_b['openness'] * t,
        'width': shape_a['width'] * (1 - t) + shape_b['width'] * t,
        'roundness': shape_a['roundness'] * (1 - t) + shape_b['roundness'] * t,
    }


def get_shape_at_time(t: float, cues: list) -> dict:
    """Get interpolated mouth shape at time t with smooth transitions."""
    TRANSITION_DURATION = 0.04  # 40ms transition between shapes

    current_cue = None
    next_cue = None

    for i, cue in enumerate(cues):
        if cue['start'] <= t < cue['end']:
            current_cue = cue
            if i + 1 < len(cues):
                next_cue = cues[i + 1]
            break

    if current_cue is None:
        return MOUTH_SHAPES['X']

    current_shape = MOUTH_SHAPES.get(current_cue['value'], MOUTH_SHAPES['X'])

    # Smooth transition near boundaries
    time_to_end = current_cue['end'] - t
    if next_cue and time_to_end < TRANSITION_DURATION:
        next_shape = MOUTH_SHAPES.get(next_cue['value'], MOUTH_SHAPES['X'])
        blend = 1.0 - (time_to_end / TRANSITION_DURATION)
        return interpolate_shape(current_shape, next_shape, blend)

    time_from_start = t - current_cue['start']
    if time_from_start < TRANSITION_DURATION:
        # Find previous shape
        prev_idx = cues.index(current_cue) - 1
        if prev_idx >= 0:
            prev_shape = MOUTH_SHAPES.get(cues[prev_idx]['value'], MOUTH_SHAPES['X'])
            blend = time_from_start / TRANSITION_DURATION
            return interpolate_shape(prev_shape, current_shape, blend)

    return current_shape


def draw_mouth(frame: np.ndarray, face_info: dict, shape: dict, t: float, quality: str = 'high'):
    """Draw animated mouth on the frame."""
    cx, cy = face_info['mouth_center']
    base_w = face_info['mouth_width']
    base_h = face_info['mouth_height']

    openness = shape['openness']
    width_factor = shape['width']
    roundness = shape['roundness']

    # Calculate mouth dimensions
    mw = int(base_w * width_factor * 0.55)
    open_h = int(base_h * (0.5 + openness * 2.5))

    # Skin color sampling (average around mouth area for blending)
    skin_region = frame[max(0, cy - base_h * 2):cy - base_h,
                        max(0, cx - mw):cx + mw]
    if skin_region.size > 0:
        skin_color = skin_region.mean(axis=(0, 1)).astype(int)
    else:
        skin_color = np.array([170, 190, 220])  # fallback BGR

    # Erase original mouth area with skin color
    erase_h = int(base_h * 1.8)
    erase_w = int(base_w * 0.6)
    cv2.ellipse(frame, (cx, cy), (erase_w, erase_h), 0, 0, 360,
                tuple(int(c) for c in skin_color), -1)

    # Gaussian blur the erase zone edges for natural blending
    if quality == 'high':
        mask = np.zeros(frame.shape[:2], dtype=np.uint8)
        cv2.ellipse(mask, (cx, cy), (erase_w + 3, erase_h + 3), 0, 0, 360, 255, -1)
        cv2.ellipse(mask, (cx, cy), (erase_w - 3, erase_h - 3), 0, 0, 360, 0, -1)
        blurred = cv2.GaussianBlur(frame, (7, 7), 2)
        frame[mask > 0] = blurred[mask > 0]

    # Lip color (slightly reddish/pink)
    lip_color = (
        max(0, int(skin_color[0] * 0.7)),    # B - darker
        max(0, int(skin_color[1] * 0.65)),    # G - darker
        min(255, int(skin_color[2] * 1.1)),   # R - slightly more red
    )

    if openness < 0.05:
        # Closed mouth - thin line
        pts = np.array([
            [cx - mw, cy],
            [cx - mw // 2, cy - 2],
            [cx, cy - 1],
            [cx + mw // 2, cy - 2],
            [cx + mw, cy],
            [cx + mw // 2, cy + 1],
            [cx, cy + 1],
            [cx - mw // 2, cy + 1],
        ], np.int32)
        cv2.fillPoly(frame, [pts], lip_color)
        cv2.polylines(frame, [pts], True, tuple(max(0, c - 30) for c in lip_color), 1, cv2.LINE_AA)
    else:
        # Open mouth
        # Outer lip shape
        if roundness > 0.5:
            # Rounded mouth (O, OO shapes)
            round_w = int(mw * (0.6 + (1 - roundness) * 0.4))
            cv2.ellipse(frame, (cx, cy), (round_w, open_h), 0, 0, 360, lip_color, -1)
            cv2.ellipse(frame, (cx, cy), (round_w, open_h), 0, 0, 360,
                        tuple(max(0, c - 40) for c in lip_color), 2, cv2.LINE_AA)
            # Inner dark mouth
            inner_w = int(round_w * 0.7)
            inner_h = int(open_h * 0.65)
            cv2.ellipse(frame, (cx, cy), (inner_w, inner_h), 0, 0, 360, (25, 15, 30), -1)
        else:
            # Wide mouth
            # Upper lip
            upper_pts = np.array([
                [cx - mw, cy],
                [cx - mw * 2 // 3, cy - open_h // 3],
                [cx - mw // 4, cy - open_h // 2],
                [cx, cy - open_h // 2 - 2],
                [cx + mw // 4, cy - open_h // 2],
                [cx + mw * 2 // 3, cy - open_h // 3],
                [cx + mw, cy],
            ], np.int32)

            # Lower lip
            lower_pts = np.array([
                [cx + mw, cy],
                [cx + mw * 2 // 3, cy + open_h * 2 // 3],
                [cx + mw // 4, cy + open_h],
                [cx, cy + open_h + 2],
                [cx - mw // 4, cy + open_h],
                [cx - mw * 2 // 3, cy + open_h * 2 // 3],
                [cx - mw, cy],
            ], np.int32)

            # Fill lips
            all_pts = np.concatenate([upper_pts, lower_pts])
            cv2.fillPoly(frame, [all_pts], lip_color)

            # Inner mouth (dark cavity)
            inner_pts_upper = np.array([
                [cx - int(mw * 0.75), cy + 2],
                [cx - mw // 3, cy - open_h // 4],
                [cx, cy - open_h // 3],
                [cx + mw // 3, cy - open_h // 4],
                [cx + int(mw * 0.75), cy + 2],
            ], np.int32)
            inner_pts_lower = np.array([
                [cx + int(mw * 0.75), cy + 2],
                [cx + mw // 3, cy + open_h * 2 // 3],
                [cx, cy + open_h * 3 // 4],
                [cx - mw // 3, cy + open_h * 2 // 3],
                [cx - int(mw * 0.75), cy + 2],
            ], np.int32)
            inner_all = np.concatenate([inner_pts_upper, inner_pts_lower])
            cv2.fillPoly(frame, [inner_all], (25, 15, 30))

            # Teeth (upper row) for wider openness
            if openness > 0.3:
                teeth_pts = np.array([
                    [cx - int(mw * 0.55), cy + 2],
                    [cx - mw // 4, cy - open_h // 6],
                    [cx, cy - open_h // 5],
                    [cx + mw // 4, cy - open_h // 6],
                    [cx + int(mw * 0.55), cy + 2],
                    [cx + int(mw * 0.55), cy + open_h // 5],
                    [cx, cy + open_h // 6],
                    [cx - int(mw * 0.55), cy + open_h // 5],
                ], np.int32)
                cv2.fillPoly(frame, [teeth_pts], (245, 245, 240))
                # Tooth line
                cv2.line(frame, (cx, cy - open_h // 6), (cx, cy + open_h // 6),
                         (220, 220, 215), 1, cv2.LINE_AA)

            # Lip outline
            cv2.polylines(frame, [upper_pts], False,
                          tuple(max(0, c - 40) for c in lip_color), 1, cv2.LINE_AA)
            cv2.polylines(frame, [lower_pts], False,
                          tuple(max(0, c - 40) for c in lip_color), 1, cv2.LINE_AA)


def add_subtle_motion(frame: np.ndarray, t: float, face_info: dict) -> np.ndarray:
    """Add subtle breathing/idle motion to make it feel alive."""
    h, w = frame.shape[:2]

    # Very subtle head sway (simulates natural micro-movements)
    shift_x = math.sin(t * 0.5) * 1.2 + math.sin(t * 1.3) * 0.5
    shift_y = math.sin(t * 0.7) * 0.8 + math.cos(t * 0.4) * 0.3

    # Very subtle zoom (breathing)
    breath = 1.0 + math.sin(t * 0.8) * 0.002

    M = np.float32([
        [breath, 0, shift_x - (breath - 1) * w / 2],
        [0, breath, shift_y - (breath - 1) * h / 2]
    ])
    return cv2.warpAffine(frame, M, (w, h), borderMode=cv2.BORDER_REFLECT_101)


# ============================================================================
# STEP 4: VIDEO RENDERING
# ============================================================================

def render_video(
    face_path: str,
    audio_path: str,
    output_path: str,
    cues: dict,
    face_info: dict,
    fps: int = 30,
    quality: str = 'high',
    mode: str = 'full',
):
    """Render the talking face video."""
    duration = cues['metadata']['duration']
    total_frames = int(duration * fps)
    face_img = cv2.imread(face_path)
    h, w = face_img.shape[:2]

    print(f"Rendering {total_frames} frames at {fps}fps ({duration:.1f}s)...")

    # Temp video file (without audio)
    temp_video = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
    temp_video.close()

    if mode == 'overlay':
        # Transparent background - render as PNG sequence then encode
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(temp_video.name, fourcc, fps, (w, h))
    else:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(temp_video.name, fourcc, fps, (w, h))

    mouth_cues = cues['mouthCues']

    for frame_idx in range(total_frames):
        t = frame_idx / fps

        # Get interpolated mouth shape
        shape = get_shape_at_time(t, mouth_cues)

        if mode == 'overlay':
            # Black background with just the mouth animation
            frame = np.zeros((h, w, 3), dtype=np.uint8)
            draw_mouth(frame, face_info, shape, t, quality)
        else:
            frame = face_img.copy()
            draw_mouth(frame, face_info, shape, t, quality)
            frame = add_subtle_motion(frame, t, face_info)

        out.write(frame)

        # Progress
        if frame_idx % (fps * 2) == 0:
            pct = int(frame_idx / total_frames * 100)
            print(f"  Progress: {pct}% ({frame_idx}/{total_frames})")

    out.release()
    print(f"  Frames rendered: {total_frames}")

    # Mux with audio using ffmpeg
    print("Muxing audio...")
    subprocess.run([
        'ffmpeg', '-y',
        '-i', temp_video.name,
        '-i', audio_path,
        '-c:v', 'libx264',
        '-preset', 'medium' if quality == 'high' else 'fast',
        '-crf', '18' if quality == 'high' else '23',
        '-c:a', 'aac', '-b:a', '192k',
        '-shortest',
        '-movflags', '+faststart',
        output_path
    ], capture_output=True, check=True)

    os.unlink(temp_video.name)

    size = os.path.getsize(output_path)
    print(f"Output: {output_path} ({size:,} bytes)")


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Generate talking face video from photo + audio',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --face avatar.jpg --audio speech.wav --output talking.mp4
  %(prog)s --face avatar.jpg --audio speech.wav --output talking.mp4 --fps 30 --quality high
  %(prog)s --face avatar.jpg --audio speech.wav --output cues.json --mode cues
  %(prog)s --face avatar.jpg --audio speech.wav --output mouth.mp4 --mode overlay
  %(prog)s --face avatar.jpg --audio speech.wav --output talking.mp4 --dialogue "Hello, welcome to this tutorial"
        """
    )
    parser.add_argument('--face', required=True, help='Path to face photo (JPG/PNG)')
    parser.add_argument('--audio', required=True, help='Path to audio file (WAV/MP3)')
    parser.add_argument('--output', required=True, help='Output path (.mp4 or .json for cues mode)')
    parser.add_argument('--fps', type=int, default=30, help='Video frame rate (default: 30)')
    parser.add_argument('--quality', choices=['low', 'medium', 'high'], default='high',
                        help='Render quality (default: high)')
    parser.add_argument('--mode', choices=['full', 'overlay', 'cues'], default='full',
                        help='Output mode: full video, overlay only, or just cues JSON')
    parser.add_argument('--dialogue', default=None,
                        help='Dialogue text (helps Rhubarb with better phoneme recognition)')

    args = parser.parse_args()

    # Validate inputs
    if not os.path.exists(args.face):
        print(f"ERROR: Face image not found: {args.face}")
        sys.exit(1)
    if not os.path.exists(args.audio):
        print(f"ERROR: Audio file not found: {args.audio}")
        sys.exit(1)

    # Ensure tools are available
    print("=" * 60)
    print("LIP SYNC GENERATOR")
    print("=" * 60)

    rhubarb_bin = ensure_rhubarb()
    model_path = ensure_mediapipe_model()

    # Step 1: Get mouth cues from audio
    print("\n[1/3] Analyzing audio with Rhubarb...")
    cues = get_mouth_cues(args.audio, rhubarb_bin, args.dialogue)
    print(f"  Found {len(cues['mouthCues'])} mouth cues over {cues['metadata']['duration']:.1f}s")

    if args.mode == 'cues':
        # Just output the cues JSON
        with open(args.output, 'w') as f:
            json.dump(cues, f, indent=2)
        print(f"\nCues saved to: {args.output}")
        return

    # Step 2: Detect face landmarks
    print("\n[2/3] Detecting face landmarks with MediaPipe...")
    face_info = detect_face_landmarks(args.face, model_path)
    if face_info['detected']:
        print(f"  Face detected! Mouth at {face_info['mouth_center']}")
    else:
        print(f"  Using fallback mouth position: {face_info['mouth_center']}")

    # Step 3: Render video
    print(f"\n[3/3] Rendering video ({args.mode} mode, {args.quality} quality)...")
    render_video(
        face_path=args.face,
        audio_path=args.audio,
        output_path=args.output,
        cues=cues,
        face_info=face_info,
        fps=args.fps,
        quality=args.quality,
        mode=args.mode,
    )

    print("\n" + "=" * 60)
    print("DONE!")
    print(f"Output: {args.output}")
    print("=" * 60)


if __name__ == '__main__':
    main()
