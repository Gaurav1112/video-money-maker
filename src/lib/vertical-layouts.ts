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

/** Universal safe zone — visible on all platforms */
export const SAFE_ZONE = {
  top: 108,
  bottom: 370,
  left: 60,
  right: 120,
  contentWidth: 900,
  contentHeight: 1442,
  contentX: 90,
  contentY: 108,
};

/** Platform-specific safe zones */
export const PLATFORM_SAFE = {
  instagram: { top: 108, bottom: 320, left: 60, right: 120 },
  youtube: { top: 150, bottom: 250, left: 100, right: 100 },
  tiktok: { top: 150, bottom: 370, left: 50, right: 50 },
};

/** Vertical layout regions (top-to-bottom stacking) */
export const REGIONS = {
  header: { y: 30, height: 70 },
  mainContent: { y: 100, height: 1200 },
  captionZone: { y: 1320, height: 280 },
  bottomBar: { y: 1620, height: 60 },
  ctaZone: { y: 1700, height: 180 },
};

/** Font sizes scaled for vertical (larger for mobile readability) */
export const VERTICAL_SIZES = {
  heading1: 64,
  heading2: 48,
  heading3: 38,
  body: 32,
  bodySmall: 28,
  caption: 36,
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
    topHeight: 700,
    bottomY: 860,
    bottomHeight: 700,
  },
  interview: {
    questionY: 120,
    questionHeight: 300,
    answersY: 460,
    answerSpacing: 120,
  },
};
