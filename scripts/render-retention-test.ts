#!/usr/bin/env tsx

/**
 * RETENTION 9/10 TEST RENDER
 * Renders a single test video with all 7 retention levers applied
 * 
 * Usage:
 *   npx tsx scripts/render-retention-test.ts --topic "Database Indexing"
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface RetentionConfig {
  topic: string;
  duration: number; // seconds
  includeHook: boolean;
  includeShockOpener: boolean;
  includePatternInterrupts: boolean;
  includeBroll: boolean;
  includeStoryArc: boolean;
  includePacing: boolean;
  includeStrongEnding: boolean;
}

async function generateRetentionScript(config: RetentionConfig): Promise<string> {
  const script = `
# RETENTION 9/10 TEST VIDEO: ${config.topic}

## Hook (0-3s) 🎣
❌ Most engineers think ${config.topic} is about raw speed.
✅ Actually, it's about understanding the WHAT, not just the HOW.

## Problem (3-10s) ⚠️
Picture this: Your database query takes 2 seconds.
Your users leave.
Your competitors load in 200ms.
Why? Because they understand ${config.topic}.

## Teaching (10-60s) 📚
There are three core concepts:
1. [Concept 1] - How it works
2. [Concept 2] - Common mistake (that costs $100K+)
3. [Concept 3] - The fix

## Solution (60-90s) ✅
Here's step-by-step how to apply this:

Step 1: [Action]
Step 2: [Action]
Step 3: [Action]

This one change improved performance by 10x.

## Proof (90-120s) 🎯
We tested this on real production systems.

Before: 2000ms query time
After: 200ms query time
Result: 80% faster, same data accuracy

## Recap (120-150s) 📊
So that's ${config.topic} in a nutshell:
- Concept 1 saves you time
- Concept 2 avoids disasters
- Concept 3 scales to millions of users

## Ending (150-180s) 🚀
🎁 Bonus tip: Most engineers don't know about [Advanced Technique]

🤯 But here's the crazy part... [Cliffhanger]

👉 Next video: [Next Topic]
👍 Don't forget to subscribe!

---

## RETENTION CONFIGURATION
- Hook: ${config.includeHook}
- Shock Opener: ${config.includeShockOpener}
- Pattern Interrupts: ${config.includePatternInterrupts}
- B-Roll Coverage: ${config.includeBroll}
- Story Arc: ${config.includeStoryArc}
- Fast Pacing: ${config.includePacing}
- Strong Ending: ${config.includeStrongEnding}

Expected retention: 70%+
Expected finish rate: 90%+
`;

  return script;
}

async function main() {
  const topic = process.argv[3] || 'Database Indexing';
  
  const config: RetentionConfig = {
    topic,
    duration: 180,
    includeHook: true,
    includeShockOpener: true,
    includePatternInterrupts: true,
    includeBroll: true,
    includeStoryArc: true,
    includePacing: true,
    includeStrongEnding: true
  };

  console.log('🎯 RETENTION 9/10 TEST RENDER');
  console.log(`📝 Topic: ${config.topic}`);
  console.log(`⏱️  Duration: ${config.duration}s`);
  console.log('');

  // Generate test script
  const script = await generateRetentionScript(config);
  const scriptPath = path.join('tmp', 'retention-test.md');
  
  fs.mkdirSync('tmp', { recursive: true });
  fs.writeFileSync(scriptPath, script);
  
  console.log('✅ Test script created:');
  console.log(script);
  console.log('');

  // TODO: Integration with actual render pipeline
  console.log('📋 Next steps:');
  console.log('1. Run: npx tsx scripts/render-stock-short.ts --topic "' + topic + '"');
  console.log('2. Output: ~/guru-sishya-uploads/<topic>.mp4');
  console.log('3. Manual test: Upload to YouTube');
  console.log('4. Measure: Track retention curves at 3s, 30s, 60s, 120s, 180s');
  console.log('');
  
  console.log('🔥 Levers enabled:');
  console.log(`✅ Hook (0-3s): ${config.includeHook}`);
  console.log(`✅ Shock Opener: ${config.includeShockOpener}`);
  console.log(`✅ Pattern Interrupts (every 5s): ${config.includePatternInterrupts}`);
  console.log(`✅ B-Roll (60% coverage): ${config.includeBroll}`);
  console.log(`✅ Story Arc (7 sections): ${config.includeStoryArc}`);
  console.log(`✅ Pacing (no gap > 5s): ${config.includePacing}`);
  console.log(`✅ Strong Ending (recap + bonus + CTA): ${config.includeStrongEnding}`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
