# Implementation Plan: Weekly Decision Digest

**Branch**: `011-weekly-decision-digest` | **Spec**: `spec.md`

## Summary

One P1 slice: a deterministic `scripts/weekly-digest.ts` that mechanically
assembles a five-section Sunday Markdown digest from already-collected data
(`data/analytics/`, `data/channel-inventory.json`, `data/variants/`) and ends
with exactly one rule-based recommended action. A Sunday cron commits the
digest. No LLM, no new analytics, no new deps.

## File Structure

```
scripts/
  weekly-digest.ts                NEW  — entry point + pure exports
  __tests__/
    weekly-digest.test.ts         NEW  — computeDelta + recommendAction tests
.github/workflows/
  weekly-digest.yml               NEW  — Sunday 05:00 UTC cron
data/analytics/
  weekly-digest.md                GEN  — committed by cron
specs/011-weekly-decision-digest/
  spec.md plan.md tasks.md        NEW
```

## Git-History-Read Approach

The digest needs last week's values to compute deltas. Two sources are read
from git history of files that are themselves committed weekly/daily:

- **monetization.md** (Section 1): try `git show HEAD~7:data/analytics/monetization.md`;
  if that ref fails (shallow clone, short history), fall back to
  `git log --since="8 days ago" -- data/analytics/monetization.md` to find the
  oldest commit in the window and `git show <sha>:path`. If nothing resolves,
  treat as "first run — no delta yet".
- **weekly-digest.md** (Section 2): same approach against the digest's own prior
  version to extract last week's median completion.

All git reads go through one helper `gitShowPrev(path)` that runs
`git show <ref>:<path>` via `child_process.execFileSync`, catches non-zero exit,
and returns `null` on failure. Parsing the prior file is plain regex against the
known Markdown table rows — deterministic, no fabrication.

## Decision Tree Spec (Section 5 — `recommendAction`)

Input `signals` object: `{ daysSinceLastChange, completionDeltaPp,
subscriberDeltaPerWeek, weeksFlat }`. Evaluated top-to-bottom, first match wins:

1. `daysSinceLastChange != null && daysSinceLastChange < 3`
   → "Hold — let data accumulate."
2. `completionDeltaPp != null && completionDeltaPp < 0`
   → "Retention regressed — investigate the last change."
3. `completionDeltaPp != null && completionDeltaPp >= 5`
   → "Last change worked — keep current format, consider doubling down."
4. `subscriberDeltaPerWeek != null && subscriberDeltaPerWeek >= 10`
   → "Subscriber growth healthy — maintain cadence."
5. `subscriberDeltaPerWeek === 0 && completionDeltaPp === 0 && weeksFlat >= 2`
   → "Plateau — recommended pivot: a bigger move (new format / niche / collab)."
6. else → "Steady state — continue, review next Sunday."

`computeDelta(prev, curr)` returns `{ prev, curr, delta }` with `delta = curr -
prev`; if either input is `null`/`undefined` it returns `{ prev, curr, delta:
null }` so callers print "first run".

## Risks

- **Shallow CI clone**: `git show HEAD~7` fails on GitHub's default depth-1
  checkout. Mitigation: workflow uses `actions/checkout@v4` with
  `fetch-depth: 0`. The script also degrades gracefully if history is absent.
- **monetization.md format drift**: Section 1 parses the markdown table by
  row label. If F010's format changes, parsing returns `null` → "unavailable".
  Acceptable: honest degradation, no crash.
- **Sparse data early on**: only one variant pair / few JSON files exist today.
  Sections print "insufficient data" / small medians — correct behaviour.

## Constitution Check

Deterministic (pure delta/median/tree), honest (degrade to "unavailable"),
local (pure Node, zero deps). PASS.
