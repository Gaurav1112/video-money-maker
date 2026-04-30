/**
 * Layout constants for 9:16 vertical video (1080x1920).
 * Safe zones account for platform UI overlays (IG/TikTok/YT).
 * All values in pixels at 1080x1920 resolution.
 */

export const VERTICAL = {
  width: 1080,
  height: 1920,
  fps: 30,
};

/** Universal safe zone — worst-case union of all platforms (2025+ UIs) */
export const SAFE_ZONE = {
  top: 200,       // was 108 — YouTube Shorts has search+camera icons
  bottom: 400,    // was 370 — YouTube desc+buttons extend further
  left: 60,
  right: 140,     // was 120 — YouTube like/comment/share stack
  contentWidth: 880,   // 1080 - 60 - 140
  contentHeight: 1320, // 1920 - 200 - 400
  contentX: 60,
  contentY: 200,
};

/** Platform-specific safe zones (updated for 2025+ UIs) */
export const PLATFORM_SAFE = {
  instagram: { top: 120, bottom: 380, left: 60, right: 130 },
  youtube: { top: 200, bottom: 400, left: 60, right: 140 },
  tiktok: { top: 160, bottom: 370, left: 50, right: 120 },
};

/** Vertical layout regions (top-to-bottom stacking, inside safe zones) */
export const REGIONS = {
  header: { y: 120, height: 70 },          // was y:30 — below platform status bar
  mainContent: { y: 200, height: 1100 },   // was y:100,h:1200 — fits inside safe zones
  captionZone: { y: 1050, height: 220 },   // below heading+bullets zone, above avatar
  bottomBar: { y: 1500, height: 6 },       // was y:1620 — above platform bottom chrome
  ctaZone: { y: 1520, height: 0 },         // removed — CTA goes in outro only
};

/** Font sizes scaled for vertical (larger for mobile readability) */
export const VERTICAL_SIZES = {
  heading1: 64,
  heading2: 48,
  heading3: 38,
  body: 32,
  bodySmall: 28,
  caption: 64,   // was 36 — readable on phone, matches viral shorts
  code: 28,
  codeSmall: 24,
  bullet: 30,
};

/** Code display limits for vertical */
export const CODE_LIMITS = {
  maxLines: 18,
  maxCharsPerLine: 42,
  fontSize: 28,
  lineHeight: 1.5,
};

/** Component dimension maps for vertical layout */
export const COMPONENT_DIMS = {
  titleSlide: {
    topicY: 300,
    titleY: 500,
    subtitleY: 700,
    iconSize: 120,
    iconY: 150,
  },
  codeReveal: {
    codeX: 40,
    codeY: 100,
    codeWidth: 1000,
    codeHeight: 900,
    outputY: 1020,
    outputHeight: 300,
  },
  textSection: {
    headingY: 100,
    bulletStartY: 220,
    bulletSpacing: 80,
    bulletIndent: 60,
    diagramY: 600,
    diagramHeight: 700,
  },
  comparison: {
    topY: 120,
    topHeight: 480,    // was 550 — fit both cards within safe zones after TITLE_Y=210
    bottomY: 720,
    bottomHeight: 480, // was 550
  },
  interview: {
    questionY: 120,
    questionHeight: 300,
    answersY: 460,
    answerSpacing: 120,
  },
};
