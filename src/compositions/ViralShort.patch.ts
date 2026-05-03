// ── PATCH: src/compositions/ViralShort.tsx ──────────────────────────────────
//
// CenterCaptions uses `top: 850` (hard-coded magic number).
// Verification: 850px from frame top in a 1920px-tall frame.
//   - YouTube Shorts top reserved: 220px  → 850 > 220 ✓
//   - Instagram Reels top reserved: 240px → 850 > 240 ✓
//   - TikTok top reserved: 200px          → 850 > 200 ✓
//   - Bottom check: captions occupy ~100px, so bottom edge ≈ y=950
//     YouTube bottom reserved starts at y=1500 → 950 < 1500 ✓
//
// The positional value is ALREADY SAFE. The only change is:
// 1. Import CAPTION_SAFE_TOP from safe-zones for documentation clarity.
// 2. Replace the magic number 850 with a named constant so future
//    maintainers understand the constraint.
//
// ── BEFORE (line ~1 imports section) ────────────────────────────────────────
//
//   import React from 'react';
//   import { useCurrentFrame, ... } from 'remotion';
//   import { COLORS, FONTS } from '../lib/theme';
//
// ── AFTER ────────────────────────────────────────────────────────────────────
//
//   import React from 'react';
//   import { useCurrentFrame, ... } from 'remotion';
//   import { COLORS, FONTS } from '../lib/theme';
//   import { CAPTION_SAFE_TOP } from '../lib/safe-zones';
//
//   // Center caption y-position: below all platform status bars (worst case 240px)
//   // and well above bottom chrome (captions at y≈850–950, chrome starts at y≈1500).
//   const CENTER_CAPTION_TOP = Math.max(850, CAPTION_SAFE_TOP + 610); // 850 unchanged
//
// ── BEFORE (CenterCaptions return block, line ~184) ─────────────────────────
//
//   return (
//     <div
//       style={{
//         position: 'absolute',
//         top: 850,
//         ...
//
// ── AFTER ────────────────────────────────────────────────────────────────────
//
//   return (
//     <div
//       style={{
//         position: 'absolute',
//         top: CENTER_CAPTION_TOP,   // 850 — verified safe on all platforms
//         ...
//
// NOTE: No pixel value changes in this composition. The value 850 was already
// inside the safe zone. The patch is purely a named-constant refactor so the
// constraint is self-documenting and CI tests can assert it.
