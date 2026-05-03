import type { StockStoryboard } from '../stock/types.js';

export interface ShortMetadata {
  title: string;
  description: string;
  tags: string[];
}

const TITLE_MAX = 40;

function shortHook(topic: string): string {
  // Strip hashtags + collapse whitespace, then truncate to 32 chars so
  // "<hook> #Shorts" fits within YT Shorts' 40-char tap-target.
  const cleaned = topic.replace(/#\S+/g, '').replace(/\s+/g, ' ').trim();
  return cleaned.length > 32 ? cleaned.slice(0, 29).trimEnd() + '…' : cleaned;
}

function topicToTags(topic: string): string[] {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .slice(0, 10);
}

export function generateShortMetadata(
  storyboard: StockStoryboard,
  extraTags?: string[]
): ShortMetadata {
  const hook = shortHook(storyboard.topic);
  const title = `${hook} #Shorts`.slice(0, TITLE_MAX);

  const baseTags = topicToTags(storyboard.topic);
  const tags = [
    ...new Set([
      ...baseTags,
      ...(extraTags ?? []),
      'shorts',
      'techshorts',
      'systemdesign',
      'interviewprep',
      'guruSishyaIndia',
    ]),
  ];

  // Description: keyword-rich, ~250 words, link-ready. YT favours descriptions
  // with the title keyword in the first sentence + length 100-500 words.
  const sceneSummaries = storyboard.scenes
    .slice(0, 4)
    .map((s, i) => `${i + 1}. ${(s.narration || s.type).replace(/\s+/g, ' ').trim().slice(0, 110)}`)
    .join('\n');

  const niche = baseTags.slice(0, 3).map((t) => `#${t}`).join(' ');
  const broad = '#Shorts #TechShorts';
  const description = [
    `${hook} — explained in 60 seconds, in Hinglish.`,
    '',
    `In this Short you will learn ${storyboard.topic} the way a senior engineer would explain it to a junior in a code review. We cover the core idea, when to use it, the most common interview trap, and the one-line takeaway you can quote in your next FAANG / system-design round.`,
    '',
    'What you get in this 60-second Short:',
    sceneSummaries || '1. The hook — why this matters now\n2. The core mechanism\n3. The interview trap\n4. The takeaway',
    '',
    '🎯 Daily Hinglish dev-edu Shorts — system design, DSA, GATE, interview behavioural — every single day. Built by an ex-FAANG engineer for Indian developers.',
    '',
    '👉 Follow @GuruSishya-India for daily 60-second tech Shorts.',
    '👉 Comment with the topic you want covered next.',
    '',
    `${niche} ${broad}`.trim(),
  ].join('\n');

  return { title, description, tags };
}
