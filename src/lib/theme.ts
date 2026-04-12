import { loadFont } from '@remotion/google-fonts/Inter';
import { loadFont as loadCodeFont } from '@remotion/google-fonts/JetBrainsMono';

const { fontFamily: interFont } = loadFont();
const { fontFamily: jetbrainsFont } = loadCodeFont();

export const LOADED_FONTS = {
  text: interFont,
  heading: interFont,
  code: jetbrainsFont,
} as const;

export const COLORS = {
  // Light educational theme (ByteByteGo style)
  dark: '#F5F3EF',        // warm off-white background (was #0C0A15)
  darkAlt: '#FFFFFF',     // card/surface white (was #1A1625)
  saffron: '#2563EB',     // primary accent — ocean blue (was #E85D26)
  gold: '#D97706',        // warning/highlight — amber (was #FFD700)
  teal: '#059669',        // success/secondary — emerald (was #20C997)
  indigo: '#7C3AED',      // special accent — violet (was #818CF8)
  gray: '#64748B',        // secondary text — slate (was #A9ACB3)
  white: '#1E293B',       // primary text — charcoal (was #FFFFFF)
  red: '#DC2626',         // error states (was #EF4444)
  // New colors for the light theme
  cardBg: '#FFFFFF',
  cardBorder: '#E2E0DC',
  subtleText: '#94A3B8',
  warmBg: '#F5F3EF',
  warmBgAlt: '#EDE9E3',
} as const;

export const FONTS = {
  code: 'JetBrains Mono, monospace',
  text: 'Inter, sans-serif',
  heading: 'Inter, sans-serif',
} as const;

export const SIZES = {
  heading1: 72,
  heading2: 48,
  heading3: 36,
  body: 28,
  bodySmall: 22,
  caption: 16,
  code: 22,
  codeSmall: 18,
} as const;
