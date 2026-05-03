// ── PATCH: src/compositions/ShortVideo.tsx ──────────────────────────────────
//
// Problem: CaptionOverlay was wrapped in a 304px-tall clipPath container
// positioned at bottom: 226 (SAFE_ZONE_HEIGHT + CTA_BAR_HEIGHT = 150 + 76).
//
// Because CaptionOverlay's root is <AbsoluteFill> (fills its nearest
// positioned ancestor), `bottom: 50` inside the 304px container placed
// the caption at frame y = 1920 − 226 − 50 = 1644 → only 276px from the
// frame bottom. All three platforms hide content within 380–480px of
// the frame bottom, so captions were INVISIBLE on every mobile viewer.
//
// Fix: Remove the clipping wrapper. CaptionOverlay's <AbsoluteFill> now
// fills the full 1080×1920 Remotion frame. The new `bottom: CAPTION_SAFE_BOTTOM`
// (420px) in CaptionOverlay.tsx positions the caption at frame y = 1500,
// clearing YouTube Shorts (420px) and Instagram Reels (380px) chrome.
//
// ── BEFORE ──────────────────────────────────────────────────────────────────
//
//   {isContent && hasNarration && activeScene && (
//     <div style={{
//       position: 'absolute',
//       bottom: SAFE_ZONE_HEIGHT + CTA_BAR_HEIGHT,   // ← 226px — too low
//       left: 0,
//       right: 0,
//       height: 304,
//       zIndex: 50,
//       clipPath: 'inset(0)',                        // ← clipped CaptionOverlay to 304px box
//     }}>
//       <CaptionOverlay
//         key={`caption-${activeScene.audioOffsetSeconds ?? activeScene.startFrame}`}
//         text={activeScene.narration!}
//         startFrame={...}
//         durationInFrames={activeScene.endFrame - activeScene.startFrame}
//         wordTimestamps={activeScene.wordTimestamps}
//       />
//     </div>
//   )}
//
// ── AFTER ───────────────────────────────────────────────────────────────────
//
//   {isContent && hasNarration && activeScene && (
//     /* CaptionOverlay fills the full frame; bottom offset comes from
//        CAPTION_SAFE_BOTTOM (420px) inside the component itself.          */
//     <CaptionOverlay
//       key={`caption-${activeScene.audioOffsetSeconds ?? activeScene.startFrame}`}
//       text={activeScene.narration!}
//       startFrame={...}
//       durationInFrames={activeScene.endFrame - activeScene.startFrame}
//       wordTimestamps={activeScene.wordTimestamps}
//     />
//   )}
//
// ── ALSO UPDATE constants comment ───────────────────────────────────────────
//
// BEFORE:
//   const SAFE_ZONE_HEIGHT = 150;            // YouTube/Instagram UI buttons
//
// AFTER:
//   // YouTube Shorts reserves 420px from the bottom; Instagram Reels 380px.
//   // SAFE_ZONE_HEIGHT guards the CTA bar only — caption positioning is now
//   // handled by CAPTION_SAFE_BOTTOM inside CaptionOverlay.tsx.
//   const SAFE_ZONE_HEIGHT = 150;            // CTA bar bottom clearance (YT/IG buttons)
