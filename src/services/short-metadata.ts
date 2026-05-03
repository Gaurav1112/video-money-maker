import type { StockStoryboard } from '../stock/types.js';

export interface ShortMetadata {
  title: string;
  description: string;
  tags: string[];
}

function cleanTitle(topic: string): string {
  return topic.replace(/#\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);
}

function topicToTags(topic: string): string[] {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .slice(0, 10);
}

export function generateShortMetadata(storyboard: StockStoryboard, extraTags?: string[]): ShortMetadata {
  const title = cleanTitle(storyboard.topic);
  const baseTags = topicToTags(storyboard.topic);
  const tags = [...new Set([...baseTags, ...(extraTags ?? []), 'shorts', 'techshorts', 'systemdesign'])];
  const hashtagLine = tags.map((t) => `#${t}`).join(' ');
  const description = `${hashtagLine}\n\nLearn ${title} in 60 seconds. Like & Follow for daily tech shorts.`;
  return { title, description, tags };
}
