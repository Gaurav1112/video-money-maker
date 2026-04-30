/**
 * 20 Unique Video Style Templates
 * ================================
 * Each session gets a different visual style based on (topic + sessionNumber).
 * This ensures no two videos look the same, giving YouTube's algorithm
 * variety signals and letting us A/B test which style performs best.
 *
 * Selection is DETERMINISTIC: hash(topic + sessionNumber) % 20
 * No LLM, no tokens, no randomness.
 */

export interface VideoStyleTemplate {
  id: number;
  name: string;
  /** Background approach */
  bgStyle: 'light' | 'dark' | 'gradient' | 'split';
  bgColor: string;
  bgSecondary?: string;
  /** Primary content approach for text scenes */
  contentStyle: 'terminal' | 'browser' | 'ide' | 'dashboard' | 'diagram' | 'whiteboard' | 'cards' | 'timeline';
  /** Caption style */
  captionPosition: 'center' | 'bottom' | 'top';
  captionStyle: 'pill' | 'bare' | 'highlight' | 'boxed';
  /** Color accent */
  accentColor: string;
  accentSecondary: string;
  /** Typography */
  headingSize: number;
  bodyFont: 'inter' | 'jetbrains' | 'caveat';
  /** Layout */
  avatarPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'none';
  avatarSize: number;
  /** Scene transitions feel */
  transitionSpeed: 'fast' | 'medium' | 'slow';
  /** Hook style for first 5 seconds */
  hookStyle: 'bold-text' | 'question' | 'stat-counter' | 'problem-visual' | 'code-tease';
  /** HUD overlay */
  showHud: boolean;
  /** Marquee bars */
  showMarquee: boolean;
}

const STYLES: VideoStyleTemplate[] = [
  // ── Style 0: "Fireship" — dark, fast, IDE-heavy ──
  {
    id: 0, name: 'Fireship',
    bgStyle: 'dark', bgColor: '#0F172A', bgSecondary: '#1E293B',
    contentStyle: 'ide', captionPosition: 'bottom', captionStyle: 'bare',
    accentColor: '#F97316', accentSecondary: '#FB923C',
    headingSize: 36, bodyFont: 'jetbrains',
    avatarPosition: 'none', avatarSize: 0,
    transitionSpeed: 'fast', hookStyle: 'bold-text',
    showHud: false, showMarquee: false,
  },
  // ── Style 1: "ByteByteGo" — light, clean, diagram-heavy ──
  {
    id: 1, name: 'ByteByteGo',
    bgStyle: 'light', bgColor: '#F8FAFC', bgSecondary: '#FFFFFF',
    contentStyle: 'diagram', captionPosition: 'bottom', captionStyle: 'pill',
    accentColor: '#2563EB', accentSecondary: '#3B82F6',
    headingSize: 32, bodyFont: 'inter',
    avatarPosition: 'bottom-right', avatarSize: 180,
    transitionSpeed: 'medium', hookStyle: 'problem-visual',
    showHud: false, showMarquee: false,
  },
  // ── Style 2: "DevOps Pro" — dark, terminal-heavy ──
  {
    id: 2, name: 'DevOps Pro',
    bgStyle: 'dark', bgColor: '#111827', bgSecondary: '#1F2937',
    contentStyle: 'terminal', captionPosition: 'center', captionStyle: 'highlight',
    accentColor: '#10B981', accentSecondary: '#34D399',
    headingSize: 34, bodyFont: 'jetbrains',
    avatarPosition: 'bottom-left', avatarSize: 160,
    transitionSpeed: 'fast', hookStyle: 'code-tease',
    showHud: true, showMarquee: false,
  },
  // ── Style 3: "Dashboard" — dark, metrics-heavy ──
  {
    id: 3, name: 'Dashboard',
    bgStyle: 'dark', bgColor: '#0C0A15', bgSecondary: '#1A1625',
    contentStyle: 'dashboard', captionPosition: 'bottom', captionStyle: 'boxed',
    accentColor: '#8B5CF6', accentSecondary: '#A78BFA',
    headingSize: 30, bodyFont: 'inter',
    avatarPosition: 'top-right', avatarSize: 140,
    transitionSpeed: 'medium', hookStyle: 'stat-counter',
    showHud: true, showMarquee: false,
  },
  // ── Style 4: "Whiteboard" — cream, hand-drawn ──
  {
    id: 4, name: 'Whiteboard',
    bgStyle: 'light', bgColor: '#FEF6E4', bgSecondary: '#FEFCE8',
    contentStyle: 'whiteboard', captionPosition: 'bottom', captionStyle: 'bare',
    accentColor: '#DC2626', accentSecondary: '#EF4444',
    headingSize: 38, bodyFont: 'caveat',
    avatarPosition: 'bottom-right', avatarSize: 200,
    transitionSpeed: 'slow', hookStyle: 'question',
    showHud: false, showMarquee: false,
  },
  // ── Style 5: "API Docs" — light, browser-heavy ──
  {
    id: 5, name: 'API Docs',
    bgStyle: 'light', bgColor: '#F5F3EF', bgSecondary: '#FFFFFF',
    contentStyle: 'browser', captionPosition: 'center', captionStyle: 'pill',
    accentColor: '#0891B2', accentSecondary: '#06B6D4',
    headingSize: 32, bodyFont: 'inter',
    avatarPosition: 'bottom-right', avatarSize: 180,
    transitionSpeed: 'medium', hookStyle: 'bold-text',
    showHud: false, showMarquee: true,
  },
  // ── Style 6: "Neon Code" — dark, vibrant ──
  {
    id: 6, name: 'Neon Code',
    bgStyle: 'dark', bgColor: '#0A0A0A', bgSecondary: '#171717',
    contentStyle: 'ide', captionPosition: 'center', captionStyle: 'highlight',
    accentColor: '#E879F9', accentSecondary: '#F0ABFC',
    headingSize: 36, bodyFont: 'jetbrains',
    avatarPosition: 'none', avatarSize: 0,
    transitionSpeed: 'fast', hookStyle: 'code-tease',
    showHud: true, showMarquee: false,
  },
  // ── Style 7: "Enterprise" — light, formal ──
  {
    id: 7, name: 'Enterprise',
    bgStyle: 'gradient', bgColor: '#F1F5F9', bgSecondary: '#E2E8F0',
    contentStyle: 'diagram', captionPosition: 'bottom', captionStyle: 'boxed',
    accentColor: '#1D4ED8', accentSecondary: '#2563EB',
    headingSize: 30, bodyFont: 'inter',
    avatarPosition: 'bottom-right', avatarSize: 160,
    transitionSpeed: 'slow', hookStyle: 'problem-visual',
    showHud: false, showMarquee: true,
  },
  // ── Style 8: "Hacker" — green-on-black ──
  {
    id: 8, name: 'Hacker',
    bgStyle: 'dark', bgColor: '#000000', bgSecondary: '#0A0A0A',
    contentStyle: 'terminal', captionPosition: 'center', captionStyle: 'bare',
    accentColor: '#22C55E', accentSecondary: '#4ADE80',
    headingSize: 34, bodyFont: 'jetbrains',
    avatarPosition: 'bottom-left', avatarSize: 150,
    transitionSpeed: 'fast', hookStyle: 'code-tease',
    showHud: true, showMarquee: false,
  },
  // ── Style 9: "Minimalist" — white, spacious ──
  {
    id: 9, name: 'Minimalist',
    bgStyle: 'light', bgColor: '#FFFFFF', bgSecondary: '#FAFAFA',
    contentStyle: 'cards', captionPosition: 'bottom', captionStyle: 'bare',
    accentColor: '#18181B', accentSecondary: '#3F3F46',
    headingSize: 40, bodyFont: 'inter',
    avatarPosition: 'bottom-right', avatarSize: 200,
    transitionSpeed: 'slow', hookStyle: 'bold-text',
    showHud: false, showMarquee: false,
  },
  // ── Style 10: "Gradient" — colorful gradient bg ──
  {
    id: 10, name: 'Gradient',
    bgStyle: 'gradient', bgColor: '#1E1B4B', bgSecondary: '#312E81',
    contentStyle: 'diagram', captionPosition: 'center', captionStyle: 'highlight',
    accentColor: '#F59E0B', accentSecondary: '#FBBF24',
    headingSize: 34, bodyFont: 'inter',
    avatarPosition: 'bottom-right', avatarSize: 180,
    transitionSpeed: 'medium', hookStyle: 'stat-counter',
    showHud: false, showMarquee: false,
  },
  // ── Style 11: "Split Screen" — left info, right visual ──
  {
    id: 11, name: 'Split Screen',
    bgStyle: 'split', bgColor: '#1E293B', bgSecondary: '#F8FAFC',
    contentStyle: 'ide', captionPosition: 'bottom', captionStyle: 'pill',
    accentColor: '#0EA5E9', accentSecondary: '#38BDF8',
    headingSize: 28, bodyFont: 'inter',
    avatarPosition: 'bottom-left', avatarSize: 160,
    transitionSpeed: 'medium', hookStyle: 'problem-visual',
    showHud: false, showMarquee: false,
  },
  // ── Style 12: "Warm Dark" — cozy dark theme ──
  {
    id: 12, name: 'Warm Dark',
    bgStyle: 'dark', bgColor: '#1C1917', bgSecondary: '#292524',
    contentStyle: 'cards', captionPosition: 'center', captionStyle: 'pill',
    accentColor: '#F97316', accentSecondary: '#FB923C',
    headingSize: 34, bodyFont: 'inter',
    avatarPosition: 'bottom-right', avatarSize: 180,
    transitionSpeed: 'medium', hookStyle: 'question',
    showHud: false, showMarquee: false,
  },
  // ── Style 13: "Blueprint" — blue-tinted technical ──
  {
    id: 13, name: 'Blueprint',
    bgStyle: 'dark', bgColor: '#0C1222', bgSecondary: '#162032',
    contentStyle: 'diagram', captionPosition: 'bottom', captionStyle: 'boxed',
    accentColor: '#3B82F6', accentSecondary: '#60A5FA',
    headingSize: 32, bodyFont: 'jetbrains',
    avatarPosition: 'top-right', avatarSize: 140,
    transitionSpeed: 'medium', hookStyle: 'problem-visual',
    showHud: true, showMarquee: false,
  },
  // ── Style 14: "Retro Terminal" — amber on dark ──
  {
    id: 14, name: 'Retro Terminal',
    bgStyle: 'dark', bgColor: '#0A0A0A', bgSecondary: '#141414',
    contentStyle: 'terminal', captionPosition: 'center', captionStyle: 'highlight',
    accentColor: '#D97706', accentSecondary: '#F59E0B',
    headingSize: 32, bodyFont: 'jetbrains',
    avatarPosition: 'none', avatarSize: 0,
    transitionSpeed: 'fast', hookStyle: 'code-tease',
    showHud: true, showMarquee: false,
  },
  // ── Style 15: "Notebook" — cream, scholarly ──
  {
    id: 15, name: 'Notebook',
    bgStyle: 'light', bgColor: '#FAF8F5', bgSecondary: '#F3F0EB',
    contentStyle: 'whiteboard', captionPosition: 'bottom', captionStyle: 'bare',
    accentColor: '#B91C1C', accentSecondary: '#DC2626',
    headingSize: 36, bodyFont: 'caveat',
    avatarPosition: 'bottom-right', avatarSize: 200,
    transitionSpeed: 'slow', hookStyle: 'question',
    showHud: false, showMarquee: false,
  },
  // ── Style 16: "Cloud Console" — browser + dashboard mix ──
  {
    id: 16, name: 'Cloud Console',
    bgStyle: 'light', bgColor: '#F0F4F8', bgSecondary: '#FFFFFF',
    contentStyle: 'browser', captionPosition: 'bottom', captionStyle: 'pill',
    accentColor: '#4F46E5', accentSecondary: '#6366F1',
    headingSize: 30, bodyFont: 'inter',
    avatarPosition: 'bottom-right', avatarSize: 160,
    transitionSpeed: 'medium', hookStyle: 'stat-counter',
    showHud: false, showMarquee: true,
  },
  // ── Style 17: "Cyberpunk" — dark with neon accents ──
  {
    id: 17, name: 'Cyberpunk',
    bgStyle: 'dark', bgColor: '#0A0118', bgSecondary: '#150225',
    contentStyle: 'ide', captionPosition: 'center', captionStyle: 'highlight',
    accentColor: '#06B6D4', accentSecondary: '#22D3EE',
    headingSize: 36, bodyFont: 'jetbrains',
    avatarPosition: 'bottom-left', avatarSize: 150,
    transitionSpeed: 'fast', hookStyle: 'bold-text',
    showHud: true, showMarquee: false,
  },
  // ── Style 18: "Data Science" — dark, charts-heavy ──
  {
    id: 18, name: 'Data Science',
    bgStyle: 'dark', bgColor: '#0F172A', bgSecondary: '#1E293B',
    contentStyle: 'dashboard', captionPosition: 'bottom', captionStyle: 'boxed',
    accentColor: '#14B8A6', accentSecondary: '#2DD4BF',
    headingSize: 30, bodyFont: 'inter',
    avatarPosition: 'top-right', avatarSize: 140,
    transitionSpeed: 'medium', hookStyle: 'stat-counter',
    showHud: true, showMarquee: false,
  },
  // ── Style 19: "Teaching" — light, avatar-prominent ──
  {
    id: 19, name: 'Teaching',
    bgStyle: 'light', bgColor: '#F5F3EF', bgSecondary: '#FFFFFF',
    contentStyle: 'timeline', captionPosition: 'center', captionStyle: 'pill',
    accentColor: '#059669', accentSecondary: '#10B981',
    headingSize: 34, bodyFont: 'inter',
    avatarPosition: 'bottom-right', avatarSize: 220,
    transitionSpeed: 'slow', hookStyle: 'question',
    showHud: false, showMarquee: true,
  },
];

/**
 * Select a video style template deterministically.
 * Same topic + sessionNumber always returns the same style.
 */
export function getVideoStyleTemplate(topic: string, sessionNumber: number): VideoStyleTemplate {
  let hash = 0;
  const key = `${topic}-${sessionNumber}`;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % STYLES.length;
  return STYLES[index];
}

/**
 * Get all 20 style names for reference.
 */
export function getAllStyleNames(): string[] {
  return STYLES.map(s => `${s.id}: ${s.name}`);
}
