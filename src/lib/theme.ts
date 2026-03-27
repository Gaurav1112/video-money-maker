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
  dark: '#0C0A15',
  darkAlt: '#1A1625',
  saffron: '#E85D26',
  gold: '#FFD700',
  teal: '#20C997',
  indigo: '#818CF8',
  gray: '#A9ACB3',
  white: '#FFFFFF',
  red: '#EF4444',
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
