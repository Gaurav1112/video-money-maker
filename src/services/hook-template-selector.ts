export const HOOK_TEMPLATES = ['number', 'contradiction', 'curiosity-gap', 'pov-callout', 'before-after'] as const;
export type HookTemplate = typeof HOOK_TEMPLATES[number];

export function selectHookTemplate(topicId: number | string): HookTemplate {
  const n = typeof topicId === 'string' ? hashString(topicId) : topicId;
  return HOOK_TEMPLATES[Math.abs(n) % 5];
}

function hashString(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
