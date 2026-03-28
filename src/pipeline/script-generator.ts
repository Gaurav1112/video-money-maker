import { SessionInput, Scene, SceneType } from '../types';
import type { AnimationCue, SfxTrigger } from '../types';
import { NARRATION_SPEEDS, SCENE_DEFAULTS, TIMING } from '../lib/constants';
import { renderMermaidToSvg } from './mermaid-renderer';
import { SyncTimeline } from '../lib/sync-engine';

interface ScriptOptions {
  language?: string; // 'python' | 'java' -- which code examples to use
  maxScenes?: number;
  nextTopic?: string; // Optional: next session topic for end-of-video tease
}

// ---------------------------------------------------------------------------
// Teaching Technique: Analogy Generator (Khan GS + 3Blue1Brown style)
// Every major concept gets a real-world analogy to build intuition.
// ---------------------------------------------------------------------------
const ANALOGIES: Record<string, string> = {
  'load balancing': 'Think of it like a restaurant with multiple chefs. Instead of one chef cooking everything and getting overwhelmed, a host distributes orders across all chefs equally.',
  'hash map': 'Imagine a library where instead of searching every shelf, you have a magic index card that tells you exactly which shelf your book is on.',
  'binary search': 'It is like finding a word in a dictionary. You don\'t start from page 1. You open the middle, then decide whether to go left or right.',
  'cache': 'Think of it like keeping your most-used apps on your phone\'s home screen instead of searching through all apps every time.',
  'queue': 'Like a line at a ticket counter. First person in line gets served first.',
  'stack': 'Like a stack of plates. You always take the top plate first.',
  'tree': 'Like a family tree. Each person can have children, and those children can have their own children.',
  'graph': 'Like a social network. People are connected to other people, and those connections can go in any direction.',
  'recursion': 'Like standing between two mirrors. You see yourself reflected infinitely, each reflection slightly smaller.',
  'api': 'Like a waiter in a restaurant. You tell the waiter what you want, the waiter goes to the kitchen, and brings back your food.',
  'database': 'Like a giant Excel spreadsheet that can handle millions of rows and multiple people reading and writing at the same time.',
  'microservices': 'Instead of one giant kitchen handling everything, imagine separate food stalls each specializing in one dish. Pizza stall, burger stall, drinks stall. Each works independently.',
  'linked list': 'Like a treasure hunt where each clue tells you where to find the next clue. You have to follow the chain.',
  'array': 'Like a row of lockers in a school hallway. Each locker has a number, and you can go directly to any locker if you know its number.',
  'dynamic programming': 'Like filling out a multiplication table. Each cell uses values you already calculated, so you never solve the same problem twice.',
  'sorting': 'Like organizing a messy bookshelf. You could do it slowly by checking every book, or smartly by dividing the shelf into sections first.',
  'http': 'Like sending a letter. You write a request, put it in an envelope with an address, send it, and wait for a reply.',
  'tcp': 'Like a phone call. Both sides confirm they can hear each other before the conversation starts.',
  'dns': 'Like a phone book for the internet. You look up a name and get a number back.',
  'docker': 'Like a shipping container. Everything your app needs is packed inside, and it works the same no matter where you ship it.',
  'kubernetes': 'Like an air traffic controller for shipping containers. It decides where each container goes, restarts them if they crash, and scales up when traffic increases.',
  'promise': 'Like ordering food at a counter. They give you a receipt number. You can go sit down, and they\'ll call your number when the food is ready.',
  'mutex': 'Like a bathroom key at a coffee shop. Only one person can use it at a time. Everyone else waits their turn.',
  'deadlock': 'Like two people in a narrow hallway, each waiting for the other to move first. Neither can make progress.',
  'big o': 'Like asking how long a road trip takes. You don\'t want the exact minutes. You want to know: is it a quick drive or a cross-country journey?',
};

/**
 * Find the best-matching analogy for a topic by checking if any analogy key
 * appears as a substring of the topic (or vice-versa).
 */
function getAnalogy(topic: string): string | null {
  const lower = topic.toLowerCase();
  // Exact key match first
  if (ANALOGIES[lower]) return ANALOGIES[lower];
  // Partial match — analogy key is substring of topic
  for (const [key, analogy] of Object.entries(ANALOGIES)) {
    if (lower.includes(key) || key.includes(lower)) return analogy;
  }
  // Word-level match — any word from the topic matches a key word
  const topicWords = lower.split(/\s+/);
  for (const [key, analogy] of Object.entries(ANALOGIES)) {
    const keyWords = key.split(/\s+/);
    if (keyWords.some(kw => topicWords.includes(kw) && kw.length > 3)) return analogy;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Teaching Technique: Repetition (DISABLED — was causing word soup)
// Kept as no-op for API compatibility; previously restated concepts 3x.
// ---------------------------------------------------------------------------
function reinforceConcept(concept: string, _topic: string): string {
  return concept;
}

// ---------------------------------------------------------------------------
// Retention Technique: Mid-Scene Open Loops (re-engagement phrases)
// Injected every 60-90 seconds during the deep dive to keep viewers watching.
// ---------------------------------------------------------------------------
const OPEN_LOOP_PHRASES = [
  'But here\'s where it gets really interesting...',
  'Stay with me, because this next part is gold...',
  'Now THIS is what actually matters in interviews...',
  'Most people miss this completely...',
  'Here\'s the part that will blow your mind...',
  'Keep watching — this is the piece everyone skips...',
  'This next idea changes everything...',
];

function getOpenLoopPhrase(seed: number): string {
  return OPEN_LOOP_PHRASES[seed % OPEN_LOOP_PHRASES.length];
}

// ---------------------------------------------------------------------------
// Teaching Technique: "Aha Moment" Phrases (NeetCode style)
// ---------------------------------------------------------------------------
const AHA_PHRASES = [
  'And HERE is the key insight that changes everything...',
  'Now this is the part that separates good from GREAT engineers...',
  'Once you understand THIS, the whole concept clicks...',
  'This is the secret that most tutorials don\'t tell you...',
  'Pay attention to this next part. This is GOLD for interviews...',
  'THIS is the trick. Once you see it, you can\'t unsee it...',
  'Here is the moment everything comes together...',
];

function getAhaPhrase(seed: number): string {
  return AHA_PHRASES[seed % AHA_PHRASES.length];
}

// ---------------------------------------------------------------------------
// Teaching Technique: Emotional Encouragement (Khan GS style)
// ---------------------------------------------------------------------------
const ENCOURAGEMENT = [
  'You are doing amazing. Most people give up at this point, but not you.',
  'I know this is challenging. But trust me, it gets easier with practice.',
  'If you have made it this far, you are already ahead of 90% of candidates.',
  'Take a breath. You are learning something that will change your career.',
  'Remember, every expert was once a beginner. You have got this.',
  'Stick with me here. This is the part where real understanding happens.',
  'The fact that you are still watching puts you ahead of the pack.',
];

function getEncouragement(seed: number): string {
  return ENCOURAGEMENT[seed % ENCOURAGEMENT.length];
}

// ---------------------------------------------------------------------------
// Teaching Technique: Interview Reality Check (NeetCode + real-world style)
// ---------------------------------------------------------------------------
function generateInterviewReality(topic: string): string {
  const realities = [
    `When an interviewer asks about ${topic}, they are not testing your memory. They want to see HOW you think about the problem.`,
    `Here is what most candidates get wrong about ${topic} in interviews. They jump straight to the solution without discussing trade-offs.`,
    `A senior engineer once told me... the best answer about ${topic} starts with WHY, not HOW.`,
    `In real interviews at Google and Amazon, ${topic} questions are about your thought process, not the perfect answer.`,
    `The number one mistake with ${topic} in interviews? Not asking clarifying questions first. Always confirm the constraints.`,
  ];
  return realities[topic.length % realities.length];
}

// ---------------------------------------------------------------------------
// Teaching Technique: Line-by-Line Code Walkthrough (Fireship style)
// ---------------------------------------------------------------------------
function generateCodeWalkthrough(code: string, _language: string): string {
  const lines = code.split('\n').filter(l => l.trim());
  if (lines.length === 0) return '';

  const parts: string[] = [];
  if (lines[0]) {
    parts.push(`We ${describeCodeLine(lines[0])}`);
  }
  if (lines.length > 2) {
    const midIdx = Math.floor(lines.length / 2);
    parts.push(`then ${describeCodeLine(lines[midIdx])}`);
  }
  if (lines.length > 1 && lines[lines.length - 1]) {
    parts.push(`and ${describeCodeLine(lines[lines.length - 1])}`);
  }

  return parts.join(', ') + '.';
}

function describeCodeLine(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith('class ')) return `define our ${trimmed.split(' ')[1]} class`;
  if (trimmed.startsWith('def ') || trimmed.startsWith('function ')) return 'create a function that handles the main logic';
  if (trimmed.startsWith('return ')) return 'return our result';
  if (trimmed.startsWith('for ') || trimmed.startsWith('while ')) return 'loop through each element';
  if (trimmed.startsWith('if ')) return 'check our condition';
  if (trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('var ')) return 'declare our variables';
  if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) return 'import the dependencies we need';
  if (trimmed.startsWith('print') || trimmed.startsWith('console.log')) return 'output the result to verify it works';
  if (trimmed.includes('= new ')) return 'instantiate our object';
  if (trimmed.includes('.append(') || trimmed.includes('.push(')) return 'add the element to our collection';
  if (trimmed.includes('.pop(')) return 'remove and grab the last element';
  return 'set up the next step';
}

// ---------------------------------------------------------------------------
// Storytelling Arc: THE PROBLEM — Set up tension
// ---------------------------------------------------------------------------
function generateProblemSetup(topic: string): string {
  const problems = [
    `Imagine this. You've built an amazing app. Users love it. Then one morning you wake up and your app is on the front page of Hacker News. Suddenly 10 million people are trying to use your app at the same time. Your server crashes. Your users see error pages. Your boss is calling. This is the exact problem that ${topic} solves. And if you don't understand it, you WILL face this nightmare.`,

    `Let me paint a picture for you. You're running a startup. Everything works great with 100 users. Then you get featured on Product Hunt. Traffic explodes. Without ${topic}, your entire system goes down in minutes. Real companies die because of this. Every. Single. Day. So let's make sure you never make this mistake.`,

    `Here's a scenario that happens more often than you'd think. A developer builds a system that works perfectly in testing. Ships it to production. Three months later, traffic grows 50x, and the whole thing collapses like a house of cards. The missing piece? ${topic}. Every time.`,

    `Think about this. Right now, somewhere in the world, a developer is debugging a production outage at 3 AM. They're stressed, they're tired, and they're desperately googling ${topic}. You do NOT want to be that developer. So let me teach you this now, while you have time to actually learn it properly.`,

    `Close your eyes and imagine you're in a system design interview. The interviewer says, "Design a system that handles one billion requests per day." If your brain just went blank, that's because you don't fully understand ${topic} yet. But you will in about 4 minutes.`,

    `Every second, the internet processes over 100,000 Google searches, 9,000 tweets, and 80,000 YouTube views. How does NONE of this crash? The answer starts with ${topic}. And most developers have no clue how it actually works under the hood.`,
  ];

  const seed = topic.length % problems.length;
  return problems[seed];
}

// ---------------------------------------------------------------------------
// Storytelling Arc: WRONG ANSWER — Create contrast
// ---------------------------------------------------------------------------
function generateWrongAnswer(topic: string): string {
  const wrongAnswers = [
    `Now, here's where most people go wrong. When someone asks about ${topic}, the typical answer is just the textbook definition. They recite it like a parrot. But that tells the interviewer NOTHING about your actual understanding. It's like saying a car is "a vehicle with four wheels." Technically correct. Completely useless.`,

    `The most common mistake I see is this. People learn ${topic} as a buzzword. They can name-drop it in conversation, but when you push them on the details, on the trade-offs, on the edge cases, they fall apart. And interviewers push. Hard.`,

    `Let me tell you what DOESN'T work. Memorizing the Wikipedia article on ${topic}. Watching a 2-hour lecture once and calling it done. These approaches give you a false sense of confidence that crumbles the moment someone asks a follow-up question.`,

    `Here's the trap most developers fall into. They learn the WHAT of ${topic} but never the WHY. They can tell you what it does but not why it exists, what problem it solves, or what happens when it fails. And that gap? That's exactly where interviewers live.`,

    `So many developers think they understand ${topic} because they've used it once or twice. But using something and understanding it are completely different. I've met engineers with 10 years of experience who can't explain the trade-offs. Don't be that person.`,

    `The biggest misconception about ${topic}? That there's one right answer. People learn one approach and think they're done. But in reality, ${topic} involves trade-offs. The right answer always depends on the context. And THAT understanding is what gets you hired.`,
  ];

  const seed = (topic.length * 3) % wrongAnswers.length;
  return wrongAnswers[seed];
}

// ---------------------------------------------------------------------------
// Storytelling Arc: THE REAL ANSWER — Transition into deep dive
// ---------------------------------------------------------------------------
function generateRealAnswer(topic: string): string {
  const realAnswers = [
    `Okay, so what IS the right way to think about ${topic}? Forget everything you've memorized. Let me rebuild this from first principles. And I promise, by the end, it will click so hard you'll wonder why it ever seemed confusing.`,

    `Now let me show you how ${topic} ACTUALLY works. Not the simplified version from tutorials. The real thing. The version that senior engineers at top companies use every day. And I'm going to make it simple.`,

    `Alright, here's the real answer. ${topic} is fundamentally about solving one core problem. And once you see that core problem clearly, everything else is just details. Let me show you.`,

    `So here's the truth about ${topic} that nobody tells beginners. It's not one thing. It's a family of solutions to a fundamental problem. And the magic is knowing which solution to apply when. Let me break it down.`,

    `Ready for the real explanation? ${topic} comes down to understanding three key ideas. Just three. Master these three ideas, and you can answer any interview question about ${topic} they throw at you. Here they are.`,

    `Okay, buckle up. This is where the actual learning happens. I'm going to explain ${topic} the way I wish someone had explained it to me. Step by step, with code, with visuals, with real examples. Let's go.`,
  ];

  const seed = (topic.length * 5) % realAnswers.length;
  return realAnswers[seed];
}

// ---------------------------------------------------------------------------
// Interview Secret (with guru-sishya.in reference)
// ---------------------------------------------------------------------------
function generateInterviewSecret(topic: string): string {
  const secrets = [
    `Here's the interview secret that most prep courses won't tell you. When they ask about ${topic}, they're not testing your memory. They want to see HOW you think. Start with the problem, walk through the trade-offs, and explain your reasoning out loud. That alone puts you in the top 10 percent. And you can practice this exact skill with interactive mock interviews on guru-sishya.in.`,

    `The number one thing interviewers look for in ${topic} questions is this: can you reason about failure modes? What happens when things go wrong? How do you detect it? How do you recover? If you can discuss the unhappy path fluently, you've already won. Practice this pattern on the ${topic} module at guru-sishya.in.`,

    `Want to know what ACTUALLY impresses interviewers? It's not reciting the textbook answer on ${topic}. It's asking clarifying questions first. "What's the expected scale? What are the consistency requirements? What's the latency budget?" These questions show senior-level thinking. You can drill this skill on guru-sishya.in.`,

    `Here's the insider trick for ${topic} interviews. Always tie your answer to real numbers. Don't say "it's faster." Say "it reduces P99 latency from 200 milliseconds to 15 milliseconds." Quantifying your answers makes you unforgettable. The quiz system on guru-sishya.in trains you to think exactly this way.`,

    `I'll let you in on a secret. The best answer to a ${topic} question starts with "it depends." Then you explain WHAT it depends on. This shows the interviewer you understand nuance, not just definitions. And that's the difference between an offer and a rejection.`,
  ];

  const seed = (topic.length * 11) % secrets.length;
  return secrets[seed];
}

// ---------------------------------------------------------------------------
// Practice Question Narration (with guru-sishya.in reference)
// ---------------------------------------------------------------------------
function generatePracticeNarration(question: string, topic: string): string {
  const intros = [
    `Okay, pop quiz time. Don't scroll ahead. Think about this for a second before I give you the answer.`,
    `Alright, let's test if you were really paying attention. Here's a question that comes up all the time in interviews.`,
    `Now I want you to pause this video for 10 seconds and think about this. Seriously. Pausing and thinking is how you actually learn.`,
    `Here's a question that trips up even experienced developers. See if you can get it right.`,
    `Before we wrap up, let me challenge you with this. If you can answer it, you truly understand ${topic}.`,
  ];

  const seed = question.length % intros.length;
  return `${intros[seed]} ${question} You can practice more questions like this with detailed explanations on guru-sishya.in.`;
}

// ---------------------------------------------------------------------------
// Summary + CTA Narration (with guru-sishya.in reference)
// ---------------------------------------------------------------------------
function generateSummaryNarration(topic: string, objectives: string[], nextTopic?: string): string {
  const topObjectives = objectives.slice(0, 3).join('. ');
  const closingEncouragement = getEncouragement(topic.length);

  // "You now know how to..." closing — specific skills from objectives
  const skill1 = objectives[0] ?? `understand ${topic}`;
  const skill2 = objectives[1] ?? `apply ${topic} in code`;
  const youLearnedClose = `You now know how to ${skill1.toLowerCase().replace(/^understand\s+/i, 'understand ')}, ${skill2.toLowerCase()}, and explain the trade-offs in an interview.`;

  // Next episode tease (only if nextTopic provided)
  const nextEpisodeTease = nextTopic
    ? ` In the next video, we'll tackle ${nextTopic}. Don't miss it.`
    : '';

  const summaries = [
    `Alright, let's bring it all together. Today you learned ${topObjectives}. ${closingEncouragement} And here's the most important thing: don't just watch this and forget. Go practice. Build it in code. Explain it to someone else. That's how it sticks. If you want the complete ${topic} course with cheatsheets, interactive quizzes, and mock interview questions, head over to guru-sishya.in. It's all there waiting for you. Drop a like if this helped, and I'll see you in the next one. ${youLearnedClose}${nextEpisodeTease}`,

    `So here's the bottom line. ${topObjectives}. ${closingEncouragement} You now know more about ${topic} than 90 percent of developers who just skim blog posts. But knowledge without practice is worthless. Go build something with ${topic} today. And if you want a structured path with coding exercises and interview prep, check out guru-sishya.in. Hit subscribe so you don't miss the next topic. Let's go. ${youLearnedClose}${nextEpisodeTease}`,

    `Let me leave you with this. ${topic} is one of those topics that comes up again and again throughout your career. What you learned today gives you a massive advantage in interviews and in production. ${closingEncouragement} Now go cement it. The complete ${topic} module with practice problems, a cheatsheet, and a mock interview is waiting for you at guru-sishya.in. See you in the next video. ${youLearnedClose}${nextEpisodeTease}`,
  ];

  const seed = topic.length % summaries.length;
  return summaries[seed];
}

// ---------------------------------------------------------------------------
// Conversational Tone (makeConversational)
// Transforms formal textbook prose into friendly, teacher-like narration.
// ---------------------------------------------------------------------------
function makeConversational(text: string): string {
  return text
    // Only fix genuinely academic phrasing — keep everything else intact
    .replace(/utilize/gi, 'use')
    .replace(/subsequently/gi, 'then')
    .replace(/functionality/gi, 'feature')
    .replace(/in order to/gi, 'to')
    .replace(/However,/g, "But")
    .replace(/Furthermore,/g, "Also,")
    .replace(/Therefore,/g, "So");
}

// ---------------------------------------------------------------------------
// Section-Specific Narration Generators
// ---------------------------------------------------------------------------
function generateDiagramNarration(heading?: string): string {
  if (heading) {
    return `Here's a diagram showing ${heading.toLowerCase()}. Notice how the components connect.`;
  }
  return 'This diagram shows how all the pieces fit together.';
}

function generateTableNarration(heading?: string): string {
  if (heading) {
    return `Here's a comparison of ${heading.toLowerCase()}. Pay attention to the trade-offs.`;
  }
  return 'Let\'s compare the approaches. Notice the key differences.';
}

function generateCalloutNarration(content: string): string {
  return `Here's an important point. ${content}`;
}

// =========================================================================
// MAIN: generateScript — Khan GS / Fireship Storytelling Arc
// =========================================================================

/**
 * Generate a video script following the Khan GS / Fireship storytelling arc:
 *
 *  1. HOOK (5s)          — Dramatic opening that creates curiosity
 *  2. THE PROBLEM (15s)  — "Imagine you have 10 million users..."
 *  3. WRONG ANSWER (12s) — "Most people think the solution is... but that's wrong"
 *  4. THE REAL ANSWER (10s) — "The real solution is... let me show you"
 *  5. DEEP DIVE (2-3 min) — Code walkthrough, step by step
 *  6. VISUAL EXPLANATION (30s) — Diagram showing how it works
 *  7. COMPARISON (30s)   — Table comparing approaches
 *  8. INTERVIEW SECRET (20s) — "Here's what interviewers ACTUALLY want to hear..."
 *  9. PRACTICE (30s)     — Quiz question with answer
 * 10. SUMMARY + CTA (15s) — "Now go practice on guru-sishya.in"
 */
export function generateScript(session: SessionInput, options: ScriptOptions = {}): Scene[] {
  const { language = 'python', maxScenes = 30, nextTopic } = options;
  const scenes: Scene[] = [];
  let currentFrame = 0;

  // ── 1. HOOK — Dramatic opening ──────────────────────────────────────────
  let hookNarration = generateHook(session.topic, session.title);

  // Inject analogy right after the hook if one exists (3Blue1Brown: intuition first)
  const analogy = getAnalogy(session.topic);
  if (analogy) {
    hookNarration += ` ${analogy}`;
  }

  // Series awareness: "This is session N of our complete [topic] series."
  hookNarration += ` This is session ${session.sessionNumber} of our complete ${session.topic} series.`;

  const titleDuration = SCENE_DEFAULTS.titleDuration;
  scenes.push({
    type: 'title',
    content: session.title,
    narration: hookNarration,
    duration: titleDuration,
    startFrame: currentFrame,
    endFrame: (currentFrame += TIMING.secondsToFrames(titleDuration)),
    bullets: session.objectives,
    heading: session.topic,
  });

  // ── 2. THE PROBLEM — Set up tension ─────────────────────────────────────
  const problemNarration = generateProblemSetup(session.topic);
  const problemDuration = 15;
  scenes.push({
    type: 'text',
    content: problemNarration,
    narration: problemNarration,
    duration: problemDuration,
    startFrame: currentFrame,
    endFrame: (currentFrame += TIMING.secondsToFrames(problemDuration)),
    heading: 'The Problem',
    bullets: [
      `Why ${session.topic} exists`,
      'What happens without it',
      'The real-world impact',
    ],
  });

  // ── 3. WRONG ANSWER — Create contrast ──────────────────────────────────
  const wrongAnswerNarration = generateWrongAnswer(session.topic);
  const wrongAnswerDuration = 12;
  scenes.push({
    type: 'text',
    content: wrongAnswerNarration,
    narration: wrongAnswerNarration,
    duration: wrongAnswerDuration,
    startFrame: currentFrame,
    endFrame: (currentFrame += TIMING.secondsToFrames(wrongAnswerDuration)),
    heading: 'The Common Mistake',
    bullets: extractBulletsFromNarration(wrongAnswerNarration, 3),
  });

  // ── 4. THE REAL ANSWER — Transition into deep dive ────────────────────
  const realAnswerNarration = generateRealAnswer(session.topic);
  const realAnswerDuration = 10;
  scenes.push({
    type: 'text',
    content: realAnswerNarration,
    narration: realAnswerNarration,
    duration: realAnswerDuration,
    startFrame: currentFrame,
    endFrame: (currentFrame += TIMING.secondsToFrames(realAnswerDuration)),
    heading: 'The Real Answer',
    bullets: extractBulletsFromNarration(realAnswerNarration, 3),
  });

  // ── 5-7. Parse content → DEEP DIVE + VISUAL + COMPARISON ─────────────
  const sections = parseMarkdown(session.content);
  let sectionIndex = 0;
  let hasInterview = false;
  let openLoopCounter = 0;     // tracks elapsed deep-dive scenes for open-loop injection
  let halfwayInjected = false; // 50% engagement prompt guard
  let reHookInjected = false;  // 60% danger zone re-hook guard

  for (const section of sections) {
    if (scenes.length >= maxScenes - 3) break; // Reserve for interview + review + summary

    if (section.type === 'callout') hasInterview = true;

    // Filter code blocks by selected language
    if (section.type === 'code' && section.language) {
      const sectionLang = section.language.toLowerCase();
      const targetLang = language.toLowerCase();
      if (sectionLang !== targetLang &&
          !['typescript', 'javascript', 'text', 'bash', 'shell', 'sql', 'json', 'yaml', 'html', 'css'].includes(sectionLang)) {
        continue;
      }
    }

    // ── 60% Danger Zone Re-Hook ─────────────────────────────────────────
    if (!reHookInjected && scenes.length === Math.floor(maxScenes * 0.6)) {
      reHookInjected = true;
      const reHookNarration = `Okay, stay with me. You've already learned the fundamentals of ${session.topic}. But this next part? This is what separates the good developers from the GREAT ones. Don't leave now.`;
      scenes.push({
        type: 'text',
        content: reHookNarration,
        narration: reHookNarration,
        duration: 8,
        startFrame: currentFrame,
        endFrame: (currentFrame += TIMING.secondsToFrames(8)),
        heading: 'The Key Insight',
        bullets: extractBulletsFromNarration(reHookNarration, 3),
      });
    }

    // ── 50% Engagement Prompt ────────────────────────────────────────────
    if (!halfwayInjected && scenes.length >= Math.floor(maxScenes * 0.5)) {
      halfwayInjected = true;
      const engagementNarration = `If you're finding this useful, drop a like. It genuinely helps more developers find this.`;
      scenes.push({
        type: 'text',
        content: engagementNarration,
        narration: engagementNarration,
        duration: 4,
        startFrame: currentFrame,
        endFrame: (currentFrame += TIMING.secondsToFrames(4)),
        heading: '',
        bullets: [],
      });
    }

    const scene = sectionToScene(section, language, currentFrame, sectionIndex, session.topic);

    // ── Mid-Scene Open Loop (every ~3 deep-dive scenes ≈ 60-90 seconds) ─
    openLoopCounter++;
    if (openLoopCounter % 3 === 0) {
      const openLoop = getOpenLoopPhrase(openLoopCounter);
      scene.narration = `${openLoop} ${scene.narration}`;
    }

    scenes.push(scene);
    currentFrame = scene.endFrame;
    sectionIndex++;
  }

  // ── 8. INTERVIEW SECRET — if not already covered by a callout ─────────
  if (!hasInterview && scenes.length < maxScenes - 2) {
    const secretNarration = generateInterviewSecret(session.topic);
    const secretDuration = SCENE_DEFAULTS.interviewDuration;
    scenes.push({
      type: 'interview',
      content: secretNarration,
      narration: secretNarration,
      duration: secretDuration,
      startFrame: currentFrame,
      endFrame: (currentFrame += TIMING.secondsToFrames(secretDuration)),
      heading: 'Interview Secret',
    });
  }

  // Interview Reality Check scene (NeetCode style — what interviewers actually think)
  if (scenes.length < maxScenes - 1) {
    const realityNarration = generateInterviewReality(session.topic);
    const realityDuration = SCENE_DEFAULTS.interviewDuration;
    scenes.push({
      type: 'interview',
      content: realityNarration,
      narration: realityNarration,
      duration: realityDuration,
      startFrame: currentFrame,
      endFrame: (currentFrame += TIMING.secondsToFrames(realityDuration)),
      heading: 'Interview Reality Check',
    });
  }

  // ── 9. PRACTICE — Review question with engaging framing ───────────────
  if (session.reviewQuestions.length > 0 && scenes.length < maxScenes - 1) {
    const question = session.reviewQuestions[0];
    const practiceNarration = generatePracticeNarration(question, session.topic);
    const duration = SCENE_DEFAULTS.reviewQuestionDuration;
    scenes.push({
      type: 'review',
      content: question,
      narration: practiceNarration,
      duration,
      startFrame: currentFrame,
      endFrame: (currentFrame += TIMING.secondsToFrames(duration)),
    });
  }

  // ── 10. SUMMARY + CTA ────────────────────────────────────────────────
  const summaryNarration = generateSummaryNarration(session.topic, session.objectives, nextTopic);
  const summaryDuration = SCENE_DEFAULTS.summaryDuration + 4; // Extra time for CTA
  scenes.push({
    type: 'summary',
    content: 'Key Takeaways',
    narration: summaryNarration,
    duration: summaryDuration,
    startFrame: currentFrame,
    endFrame: (currentFrame += TIMING.secondsToFrames(summaryDuration)),
    bullets: session.objectives.slice(0, 4),
  });

  return addStoryTransitions(scenes);
}

// ---------------------------------------------------------------------------
// Story-Aware Transitions (builds narrative tension)
// ---------------------------------------------------------------------------
function addStoryTransitions(scenes: Scene[]): Scene[] {
  // Transition phrases — one per type, used only on the FIRST occurrence
  const transitionsByType: Record<string, string> = {
    code: "Let me show you the code. ",
    diagram: "Let me show you this visually. ",
    table: "Let's compare the approaches side by side. ",
    interview: "Now for the interview insight. ",
    review: "Time to test yourself. ",
  };

  const usedTypes = new Set<string>();

  return scenes.map((scene, idx) => {
    // Skip story arc scenes (hook, problem, wrong answer, real answer) and bookend types
    if (idx <= 3 || scene.type === 'title' || scene.type === 'summary') return scene;

    // Only prepend a transition for the FIRST scene of each type
    if (!usedTypes.has(scene.type) && transitionsByType[scene.type]) {
      usedTypes.add(scene.type);
      return {
        ...scene,
        narration: transitionsByType[scene.type] + scene.narration,
      };
    }

    return scene;
  });
}

// ---------------------------------------------------------------------------
// Bullet Extraction — ensures every text scene has visible on-screen bullets
// Extracts key sentences from narration when bullets aren't explicitly provided
// ---------------------------------------------------------------------------
function extractBulletsFromNarration(narration: string, maxBullets: number = 3): string[] {
  const sentences = narration
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 15 && s.length < 120);

  if (sentences.length <= maxBullets) return sentences;

  // Pick evenly spaced sentences for visual distribution
  const step = Math.floor(sentences.length / maxBullets);
  const bullets: string[] = [];
  for (let i = 0; i < maxBullets; i++) {
    const idx = Math.min(i * step, sentences.length - 1);
    bullets.push(sentences[idx]);
  }
  return bullets;
}

// ---------------------------------------------------------------------------
// Hook Generation (33 patterns)
// Uses story openings, shocking questions/facts, challenges, pain points,
// contrarian takes, authority, and curiosity gaps.
// ---------------------------------------------------------------------------
function generateHook(topic: string, title: string): string {
  const hooks = [
    // ── Story openings (5) ──
    `In 2023, a major tech company lost 14 million dollars in revenue because of ONE poorly implemented ${topic} system. Fourteen. Million. Dollars. Let me make sure that never happens to you.`,
    `I once watched a senior engineer get rejected at Google because they couldn't explain ${topic} properly. They had 10 years of experience. Let me tell you what they got wrong.`,
    `The engineer who built Netflix's ${topic} system shared something in a blog post that changed how I think about software forever. Let me share it with you.`,
    `Picture this. It's your final round interview at Amazon. The interviewer leans forward and says, "Tell me about ${topic}." Your next 5 minutes decide your career. Are you ready?`,
    `A startup I advised went from 100 to 10 million users in 6 months. The ONLY reason they survived? They understood ${topic} deeply. Most companies don't.`,

    // ── Shocking questions (5) ──
    `What happens when 10 million users hit your server at the exact same time? If you don't know the answer, you don't understand ${topic}. Let's fix that right now.`,
    `Can you explain ${topic} in 30 seconds? Because that's exactly how long you get in an interview before they decide if you know your stuff.`,
    `Why do 73 percent of candidates fail system design interviews? One word: ${topic}. They memorize the definition but miss the point entirely.`,
    `If I asked you to design ${topic} from scratch on a whiteboard right now, could you do it? Be honest. By the end of this video, you absolutely can.`,
    `What's the ONE concept that separates a 100K developer from a 300K developer? It's not algorithms. It's not LeetCode. It's understanding ${topic} at a deep level.`,

    // ── Shocking facts (4) ──
    `Did you know? Every single request you make on the internet touches ${topic} at least three times before reaching its destination. And most developers have no idea how it works.`,
    `Here's a stat that should terrify you. 89 percent of production outages at big tech companies trace back to ${topic} failures. 89 percent.`,
    `Google processes 8.5 billion searches per day. Facebook handles 2.5 billion users. The secret sauce behind all of it? ${topic}. And I'm going to teach it to you in under 5 minutes.`,
    `The average tech interview lasts 45 minutes. ${topic} questions take up 15 of those minutes. That's one third of your interview riding on THIS topic.`,

    // ── Challenge hooks (4) ──
    `I'm going to explain ${topic} so clearly that you will NEVER forget it. That's not a promise. That's a guarantee. Let's go.`,
    `Give me 5 minutes. Just 5 minutes. And I'll teach you ${topic} better than any textbook, any course, any bootcamp ever could.`,
    `By the end of this video, you'll understand ${topic} better than 90 percent of working developers. That sounds crazy, but stick with me.`,
    `I challenge you to watch this entire video and NOT understand ${topic}. Seriously. Try. You can't. Let's begin.`,

    // ── Pain point hooks (5) ──
    `If your interviewer asks about ${topic} and you start with the textbook definition... you've already lost. Let me show you what to say instead.`,
    `Stop memorizing ${topic}. Seriously, stop it. Memorization is why you keep forgetting it. Today I'm going to help you UNDERSTAND it.`,
    `You've probably read 10 articles about ${topic} and still feel confused. That's not your fault. They explain it wrong. Let me show you the right way.`,
    `The biggest lie in computer science education? That ${topic} is complicated. It's not. It's been taught badly. Let me prove it.`,
    `Every time you open YouTube to learn ${topic}, you get a 45-minute lecture that puts you to sleep. Not today. Today you learn it in 5 minutes, and it sticks.`,

    // ── Contrarian hooks (4) ──
    `Everything your CS professor taught you about ${topic} is technically correct and completely useless in the real world. Here's what actually matters.`,
    `Hot take: most "senior" engineers don't actually understand ${topic}. They know the buzzwords, but ask them WHY it works, and they freeze. Don't be that engineer.`,
    `I'm about to explain ${topic} in a way your textbook never did. No jargon. No fluff. Just the raw truth about how it actually works.`,
    `${topic} is not what you think it is. I know that sounds dramatic, but hear me out. What they teach in school and what happens in production are two completely different things.`,

    // ── Authority hooks (4) ──
    `Google, Amazon, Meta, and Netflix all ask about ${topic} in their interviews. After studying hundreds of interview questions, I found the exact pattern they follow. Let me share it.`,
    `I've reviewed over 500 technical interview recordings. The number one reason candidates get rejected? They can't explain ${topic} with clarity and confidence. Let's fix that.`,
    `The top 1 percent of engineers all have one thing in common. They don't just USE ${topic}. They understand it deeply enough to TEACH it. That's what we're doing today.`,
    `After helping over 1000 students crack FAANG interviews, I can tell you the exact moment most interviews are won or lost. It's the ${topic} question. And here's how to nail it.`,

    // ── Curiosity gap hooks (2) ──
    `There's a reason ${topic} is asked in EVERY system design interview. And it's not the reason you think.`,
    `What if I told you that ${topic} is actually about ONE simple idea? Just one. And once you see it, you can never unsee it.`,
  ];

  // Deterministic selection based on topic+title for reproducible builds
  const seed = (topic.length * 7 + title.length * 13) % hooks.length;
  const hook = hooks[seed];
  // Hook punch fires FIRST — the topic intro follows the opening gut-punch
  return `${hook} Today's topic: ${title}.`;
}

// ---------------------------------------------------------------------------
// Markdown Parsing
// ---------------------------------------------------------------------------
interface MarkdownSection {
  type: 'text' | 'code' | 'diagram' | 'table' | 'callout';
  heading?: string;
  content: string;
  language?: string;
  rows?: string[][];
}

function parseMarkdown(markdown: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  const lines = markdown.split('\n');
  let i = 0;
  let currentHeading = '';

  while (i < lines.length) {
    const line = lines[i];

    // Headings (## through ######)
    if (/^#{2,6}\s/.test(line)) {
      currentHeading = line.replace(/^#+\s*/, '');
      i++;
      continue;
    }

    // Code blocks
    if (line.startsWith('```')) {
      const lang = line.replace('```', '').trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      sections.push({
        type: 'code',
        heading: currentHeading,
        content: codeLines.join('\n'),
        language: lang || 'typescript',
      });
      continue;
    }

    // Mermaid diagrams
    if (line.includes('mermaid') || line.includes('graph ') || line.includes('sequenceDiagram')) {
      const diagramLines: string[] = [line];
      i++;
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#')) {
        diagramLines.push(lines[i]);
        i++;
      }
      sections.push({
        type: 'diagram',
        heading: currentHeading,
        content: diagramLines.join('\n'),
      });
      continue;
    }

    // Tables (pipe-separated)
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes('|')) {
        if (!lines[i].includes('---')) { // Skip separator row
          tableLines.push(lines[i]);
        }
        i++;
      }
      const rows = tableLines.map(l =>
        l.split('|').map(cell => cell.trim()).filter(Boolean)
      );
      sections.push({
        type: 'table',
        heading: currentHeading,
        content: tableLines.join('\n'),
        rows,
      });
      continue;
    }

    // Interview callouts
    if (line.includes('Interview') || line.includes('Pro Tip') || line.includes('Key Insight')) {
      const calloutLines: string[] = [line];
      i++;
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#')) {
        calloutLines.push(lines[i]);
        i++;
      }
      sections.push({
        type: 'callout',
        heading: currentHeading,
        content: calloutLines.join(' ').replace(/[*_#>]/g, ''),
      });
      continue;
    }

    // Regular text paragraphs
    if (line.trim()) {
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() && !lines[i].startsWith('#') && !lines[i].startsWith('```') && !lines[i].startsWith('|')) {
        textLines.push(lines[i]);
        i++;
      }
      const text = textLines.join(' ').replace(/[*_]/g, '');
      if (text.length > 20) { // Skip very short fragments
        sections.push({
          type: 'text',
          heading: currentHeading,
          content: text,
        });
      }
      continue;
    }

    i++;
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Animation Cue + SFX Helpers
// ---------------------------------------------------------------------------
function generateCodeCues(narration: string, codeLineCount: number): AnimationCue[] {
  const phrases = SyncTimeline.computePhraseBoundaries(narration);
  const words = narration.split(/\s+/);
  const cues: AnimationCue[] = [];

  if (phrases.length === 0) {
    const wordsPerGroup = Math.max(1, Math.floor(words.length / codeLineCount));
    for (let line = 0; line < codeLineCount; line++) {
      cues.push({ wordIndex: line * wordsPerGroup, action: 'typeLine', target: line });
    }
  } else {
    const linesPerPhrase = Math.ceil(codeLineCount / (phrases.length + 1));
    let lineIndex = 0;
    cues.push({ wordIndex: 0, action: 'typeLine', target: 0 });
    lineIndex += linesPerPhrase;
    for (const boundary of phrases) {
      if (lineIndex >= codeLineCount) break;
      cues.push({ wordIndex: boundary + 1, action: 'typeLine', target: lineIndex });
      lineIndex += linesPerPhrase;
    }
  }

  return cues;
}

function generateTextCues(narration: string, bulletCount: number): AnimationCue[] {
  const phrases = SyncTimeline.computePhraseBoundaries(narration);
  const cues: AnimationCue[] = [
    { wordIndex: 0, action: 'revealBullet', target: 0 },
  ];

  for (let i = 0; i < Math.min(phrases.length, bulletCount - 1); i++) {
    cues.push({ wordIndex: phrases[i] + 1, action: 'revealBullet', target: i + 1 });
  }

  return cues;
}

function generateTableCues(narration: string, rowCount: number): AnimationCue[] {
  const words = narration.split(/\s+/);
  const wordsPerRow = Math.max(1, Math.floor(words.length / rowCount));
  return Array.from({ length: rowCount }, (_, i) => ({
    wordIndex: i * wordsPerRow,
    action: 'revealRow',
    target: i,
  }));
}

function generateSceneSfxTriggers(
  sceneIndex: number,
  sceneType: string,
  cues: AnimationCue[],
): SfxTrigger[] {
  const triggers: SfxTrigger[] = [];
  triggers.push({ sceneIndex, wordIndex: 0, effect: 'whoosh-in', volume: 0.4 });

  if (sceneType === 'table') {
    cues.filter(c => c.action === 'revealRow').forEach(c => {
      triggers.push({ sceneIndex, wordIndex: c.wordIndex, effect: 'ding', volume: 0.3 });
    });
  }

  return triggers;
}

// ---------------------------------------------------------------------------
// Scene Construction
// ---------------------------------------------------------------------------
function sectionToScene(
  section: MarkdownSection,
  language: string,
  currentFrame: number,
  sectionIndex: number = 0,
  topic: string = '',
): Scene {
  const type = mapSectionType(section.type);
  let narration = generateNarration(section);

  // No more stacking of aha phrases, encouragement, or repetition on every scene.
  // The narration from generateNarration() is already clean and complete.

  const speedKey = section.type === 'code' ? 'code' : section.type === 'callout' ? 'interview' : 'text';
  const wpm = NARRATION_SPEEDS[speedKey];
  const wordCount = narration.split(/\s+/).length;
  const duration = Math.max(5, Math.ceil((wordCount / wpm) * 60));
  const frames = TIMING.secondsToFrames(duration);

  // Convert mermaid diagrams to SVG
  let content = section.content;
  if (type === 'diagram') {
    try {
      content = renderMermaidToSvg(section.content);
    } catch {
      // Keep raw content if rendering fails
    }
  }

  const scene: Scene = {
    type,
    content,
    narration,
    duration,
    startFrame: currentFrame,
    endFrame: currentFrame + frames,
    heading: section.heading,
    language: section.language || language,
  };

  // Add bullets for text sections
  if (type === 'text') {
    scene.bullets = section.content
      .split(/[.!?]/)
      .map(s => s.trim())
      .filter(s => s.length > 10)
      .slice(0, 5);
  }

  // Generate animation cues based on scene type
  if (scene.type === 'code') {
    const lineCount = scene.content.split('\n').filter(l => l.trim()).length;
    scene.animationCues = generateCodeCues(scene.narration, lineCount);
  } else if (scene.type === 'text' && scene.bullets) {
    scene.animationCues = generateTextCues(scene.narration, scene.bullets.length);
  } else if (scene.type === 'table') {
    const rowCount = scene.content.split('\n').filter(l => l.includes('|')).length - 2;
    scene.animationCues = generateTableCues(scene.narration, Math.max(1, rowCount));
  }

  scene.sfxTriggers = generateSceneSfxTriggers(0, scene.type, scene.animationCues || []);

  return scene;
}

function mapSectionType(type: string): SceneType {
  const map: Record<string, SceneType> = {
    text: 'text',
    code: 'code',
    diagram: 'diagram',
    table: 'table',
    callout: 'interview',
  };
  return map[type] || 'text';
}

function generateNarration(section: MarkdownSection): string {
  switch (section.type) {
    case 'code':
      return summarizeCode(section.content, section.language || 'typescript');
    case 'diagram':
      return generateDiagramNarration(section.heading);
    case 'table':
      return generateTableNarration(section.heading);
    case 'callout':
      return generateCalloutNarration(section.content);
    case 'text':
    default: {
      // Clean markdown and make conversational
      const cleaned = section.content
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links
        .replace(/[`*_#]/g, '') // Remove markdown formatting
        .slice(0, 500); // Cap length
      return makeConversational(cleaned);
    }
  }
}

function summarizeCode(code: string, language: string): string {
  const lines = code.split('\n').filter(l => l.trim());
  const funcMatch = code.match(/(?:function|def|public\s+\w+)\s+(\w+)/);
  const classMatch = code.match(/class\s+(\w+)/);

  // Brief, clear code description — no stacking of intro + walkthrough + CTA
  if (classMatch && funcMatch) {
    return `Here's a ${classMatch[1]} class in ${language}. The ${funcMatch[1]} method handles the core logic. ${generateCodeWalkthrough(code, language)}`;
  }
  if (classMatch) {
    return `Here's the ${classMatch[1]} class in ${language}. ${generateCodeWalkthrough(code, language)}`;
  }
  if (funcMatch) {
    return `This ${funcMatch[1]} function in ${language} does the heavy lifting. ${generateCodeWalkthrough(code, language)}`;
  }
  return `Here's the ${language} implementation in ${lines.length} lines. ${generateCodeWalkthrough(code, language)}`;
}

// Add teaching pauses — only at major transition points, not after every sentence
function addTeachingPauses(text: string): string {
  // Only add a pause after questions (natural thinking moment)
  return text.replace(/\? /g, '? ... ');
}

export {
  parseMarkdown,
  generateNarration,
  generateHook,
  addTeachingPauses,
  makeConversational,
  // Teaching technique exports
  getAnalogy,
  reinforceConcept,
  getAhaPhrase,
  getEncouragement,
  generateInterviewReality,
  generateCodeWalkthrough,
  describeCodeLine,
  generateProblemSetup,
  generateWrongAnswer,
  generateRealAnswer,
  generateInterviewSecret,
  generatePracticeNarration,
  generateSummaryNarration,
  ANALOGIES,
  AHA_PHRASES,
  ENCOURAGEMENT,
};
