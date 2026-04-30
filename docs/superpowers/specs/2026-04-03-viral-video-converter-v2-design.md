# Viral Video Converter V2 — Complete Redesign Spec

**Date:** 2026-04-03
**Status:** Research Complete — Ready for Implementation
**Goal:** Transform 100-view reels into 100K+ view viral content

---

## Research Findings Summary

### Why We're Getting 100 Views (Diagnosis)
1. **Hook failure** — viewers scroll past in first 2 seconds
2. **Content classified as "educational"** — algorithm deprioritizes lectures
3. **No trending audio** — original TTS gets zero audio discovery boost
4. **Static pacing** — 10-15 sec per scene vs 1.5 sec industry standard
5. **Wrong caption style** — small, gentle fades vs big, bouncy, word-by-word highlights
6. **Too many hashtags** — 20-30 (hurts) vs 3-5 (optimal in 2026)
7. **No engagement loop** — post and ghost vs 30 min active engagement after posting

### What 100K+ Coding Reels Do Differently
- **Scene change every 1-1.5 seconds** (dopamine editing)
- **Word-by-word bouncing captions** (CapCut/Submagic style)
- **Trending audio at 15% under voiceover**
- **Hook text SLAMS in frame 1** (not fade in)
- **Zoom punches every 3-5 seconds** (1.2x-1.5x quick zoom)
- **Progress bar** showing video completion
- **Emoji reactions** at key moments
- **Loop ending** connecting back to start

### Top AI Converter Features We Need
1. **Virality scoring** (LLM-based, score 1-100)
2. **Smart clip selection** (hook detection, energy scoring)
3. **Word-by-word animated captions** (3 styles: Fireship, MrBeast, Hormozi)
4. **Content-aware crop** (face-track, code-detect, split-screen)
5. **Hook text overlay** (auto-generated, first 3 seconds)
6. **Trending audio mixing** (layer under voiceover at 15%)
7. **Auto zoom punches** (every 3-5 seconds)
8. **Platform-specific export** (YT Shorts 60s, IG Reels 90s)
9. **Branding overlay** (watermark, end card CTA)
10. **One-click mode** (URL → viral shorts in 8 minutes)

### Remotion Effects to Add
1. Spring-bounce word captions (@remotion/animated)
2. Zoom punch (interpolate scale 1→1.2→1 over 6 frames)
3. Kinetic typography (words fly in from sides)
4. Progress bar (thin line at bottom showing completion)
5. Emoji pop overlays (reaction emojis at key moments)
6. Glitch/shake transitions (between scenes)
7. Particle burst (on reveals/impacts)
8. Color sweep highlight (gradient moving across active text)

### Voice Pacing Research
- **Optimal WPM for viral shorts:** 180-220 (fast, punchy, confident)
- **Current PrabhatNeural:** ~150 WPM (too slow for shorts)
- **Fix:** Speed up TTS to 1.15x-1.25x for shorts, keep 1.0x for long videos
- **Pause pattern:** 0.3s after questions, 0.5s before reveals
- **Tone:** assertive, not lecture-like. "This is how Netflix does it" not "Let me explain"

---

## Implementation Plan

### Phase 1: Fix Long Videos (make them more engaging)
- Add zoom punches every 5 seconds
- Add progress bar at bottom
- Increase scene transition speed
- Add emoji reactions at key moments
- Speed up narration to 160-170 WPM

### Phase 2: Build Viral Shorts Converter Dashboard
- One-click URL → viral shorts
- Virality scoring (LLM-based)
- Smart clip selection
- 3 caption presets (Fireship, MrBeast, Hormozi)
- Content-aware 9:16 crop
- Platform-specific export

### Phase 3: Per-Session Metadata Files
- Each session gets a .md file with ALL hidden secrets:
  - YouTube Long: title, description, tags, hashtags, thumbnail prompt, pinned comment
  - YouTube Shorts: title, description, hashtags
  - Instagram Reel: caption, hashtags, cover text, posting time
  - SEO keywords, trending topic alignment
  - Voice pacing notes, hook script
