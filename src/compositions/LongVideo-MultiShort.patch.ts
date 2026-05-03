// ── PATCH: src/compositions/LongVideo.tsx & MultiShort.tsx ──────────────────
//
// Both compositions render <CaptionOverlay> at the Remotion root level
// (no container wrapper), so they inherit the fix automatically when
// CaptionOverlay.tsx is updated.
//
// LongVideo.tsx (landscape 1920×1080):
//   CaptionOverlay detects `width > height` → safeBottom = 80px (unchanged
//   from previous behaviour of bottom: 50/100 in landscape context where
//   platform chrome is minimal and the original values were only slightly low).
//   No positional change required.
//
// MultiShort.tsx (vertical 9:16 shorts clips):
//   CaptionOverlay detects `height > width` → safeBottom = CAPTION_SAFE_BOTTOM
//   (420px). Captions now render at y ≤ 1500 — above all platform chrome.
//   No composition-level change required; the CaptionOverlay fix is sufficient.
//
// Evidence that no wrapper exists in these files:
//
//   LongVideo.tsx:
//     <CaptionOverlay                          // ← direct render, no wrapper div
//       key={`caption-${...}`}
//       text={activeScene.narration!}
//       startFrame={...}
//       durationInFrames={...}
//       wordTimestamps={activeScene.wordTimestamps}
//       captionMode={style.captionMode}
//     />
//
//   MultiShort.tsx:
//     <CaptionOverlay                          // ← direct render, no wrapper div
//       key={`caption-${...}`}
//       text={activeScene.narration!}
//       startFrame={...}
//       durationInFrames={...}
//       wordTimestamps={activeScene.wordTimestamps}
//       captionMode={style.captionMode}
//     />
