import { SessionInput, Scene, SceneType } from '../types';
import { NARRATION_SPEEDS, SCENE_DEFAULTS, TIMING } from '../lib/constants';
import { renderMermaidToSvg } from './mermaid-renderer';

interface ScriptOptions {
  language?: string; // 'python' | 'java' -- which code examples to use
  maxScenes?: number;
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
// Teaching Technique: Repetition (Khan GS style)
// Key concepts are restated 3 times in different ways for retention.
// ---------------------------------------------------------------------------
function reinforceConcept(concept: string, topic: string): string {
  return `${concept}. Let me say that again differently... ${rephrase(concept, topic)}. In simple terms, ${simplify(concept)}.`;
}

function rephrase(concept: string, topic: string): string {
  // Strip trailing period and create a "put another way" version
  const clean = concept.replace(/\.\s*$/, '');
  return `When we talk about ${topic}, what this really means is: ${clean.toLowerCase()}`;
}

function simplify(concept: string): string {
  const clean = concept.replace(/\.\s*$/, '');
  // Keep only first clause for the simplified version
  const firstClause = clean.split(/[,;]/)[0].trim();
  return firstClause.toLowerCase();
}

// ---------------------------------------------------------------------------
// Teaching Technique: "Aha Moment" Phrases (NeetCode style)
// Inserted before key insights so the viewer knows to pay extra attention.
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
// Placed between difficult sections to keep the viewer going.
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
// Gives viewers insight into what interviewers actually think.
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
// Instead of "look at this code", we narrate each meaningful line.
// ---------------------------------------------------------------------------
function generateCodeWalkthrough(code: string, language: string): string {
  const lines = code.split('\n').filter(l => l.trim());
  let narration = `Alright, let me walk you through this ${language} code, line by line. `;

  if (lines.length === 0) return narration;

  // Narrate first meaningful line
  if (lines[0]) {
    narration += `First, we ${describeCodeLine(lines[0])}. `;
  }

  // Middle section
  if (lines.length > 2) {
    narration += `The core logic is in the middle section. `;
    // Pick a representative middle line
    const midIdx = Math.floor(lines.length / 2);
    narration += `Here, we ${describeCodeLine(lines[midIdx])}. `;
  }

  // Last line
  if (lines.length > 1 && lines[lines.length - 1]) {
    narration += `And finally, we ${describeCodeLine(lines[lines.length - 1])}. `;
  }

  narration += 'This is exactly how you would write it in a real interview.';
  return narration;
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

export function generateScript(session: SessionInput, options: ScriptOptions = {}): Scene[] {
  const { language = 'python', maxScenes = 20 } = options;
  const scenes: Scene[] = [];
  let currentFrame = 0;

  // 1. Hook + Title Scene (Khan GS style: start with WHY)
  let hookNarration = generateHook(session.topic, session.title);

  // Inject analogy right after the hook if one exists (3Blue1Brown: intuition first)
  const analogy = getAnalogy(session.topic);
  if (analogy) {
    hookNarration += ` ${analogy}`;
  }

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

  // 2. Parse markdown content into sections
  const sections = parseMarkdown(session.content);
  let sectionIndex = 0;

  for (const section of sections) {
    if (scenes.length >= maxScenes - 2) break; // Reserve space for review + summary

    // Filter code blocks by selected language
    if (section.type === 'code' && section.language) {
      const sectionLang = section.language.toLowerCase();
      const targetLang = language.toLowerCase();
      // Skip code blocks that are for a different language
      if (sectionLang !== targetLang &&
          !['typescript', 'javascript', 'text', 'bash', 'shell', 'sql', 'json', 'yaml', 'html', 'css'].includes(sectionLang)) {
        continue;
      }
    }

    const scene = sectionToScene(section, language, currentFrame, sectionIndex, session.topic);
    scenes.push(scene);
    currentFrame = scene.endFrame;
    sectionIndex++;
  }

  // 3. Interview Reality Check scene (NeetCode style — what interviewers actually think)
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

  // 4. Review Questions (if any)
  for (const question of session.reviewQuestions.slice(0, 3)) {
    if (scenes.length >= maxScenes - 1) break;
    const duration = SCENE_DEFAULTS.reviewQuestionDuration;
    scenes.push({
      type: 'review',
      content: question,
      narration: `Let's test your understanding. ${question}`,
      duration,
      startFrame: currentFrame,
      endFrame: (currentFrame += TIMING.secondsToFrames(duration)),
    });
  }

  // 5. Summary Scene with encouragement
  const summaryDuration = SCENE_DEFAULTS.summaryDuration;
  const closingEncouragement = getEncouragement(session.topic.length + session.sessionNumber);
  scenes.push({
    type: 'summary',
    content: 'Key Takeaways',
    narration: `Let's recap what we learned. ${session.objectives.slice(0, 3).join('. ')}. ${closingEncouragement} Practice these concepts and you'll ace your interview.`,
    duration: summaryDuration,
    startFrame: currentFrame,
    endFrame: (currentFrame += TIMING.secondsToFrames(summaryDuration)),
    bullets: session.objectives.slice(0, 4),
  });

  return addSceneTransitions(scenes);
}

function addSceneTransitions(scenes: Scene[]): Scene[] {
  const transitions = [
    "Now here's where it gets interesting. ",
    "Let's take this a step further. ",
    "Here's the key insight. ",
    "Now pay close attention to this part. ",
    "This is where most people get confused. ",
    "Let me break this down for you. ",
    "Building on what we just covered. ",
    "And this is the important part. ",
  ];

  return scenes.map((scene, idx) => {
    if (idx <= 1 || scene.type === 'title' || scene.type === 'summary') return scene;
    const transition = transitions[(idx * 3) % transitions.length];
    return {
      ...scene,
      narration: transition + scene.narration,
    };
  });
}

function generateHook(topic: string, title: string): string {
  const hooks = [
    // Curiosity gap
    `Most developers get ${topic} completely wrong. Let me show you why.`,
    `There's a secret about ${topic} that senior engineers don't tell you.`,
    `${topic} is simpler than you think. And harder than you expect.`,
    // Fear/urgency
    `If you can't explain ${topic} in an interview, you're not getting the job.`,
    `${topic} shows up in 90 percent of technical interviews. Are you ready?`,
    `Your interviewer will ask about ${topic}. Here's exactly what to say.`,
    // Contrarian
    `Everything you learned about ${topic} in school is wrong.`,
    `Stop memorizing ${topic}. Start understanding it.`,
    `You don't need to be a genius to master ${topic}. You just need this video.`,
    // Challenge
    `Can you solve this ${topic} problem in under 60 seconds?`,
    `I bet you can't explain ${topic} to a five year old. Challenge accepted.`,
    // Authority
    `Google, Amazon, and Meta all ask about ${topic}. Here's the pattern.`,
    `After reviewing 500 interviews, this is the number one ${topic} mistake.`,
    // Storytelling
    `I failed my first interview because of ${topic}. Here's what I learned.`,
    `The best engineer I ever worked with taught me this about ${topic}.`,
  ];
  // Deterministic selection based on topic+title to ensure reproducible builds
  const seed = (topic.length * 7 + title.length * 13) % hooks.length;
  const hook = hooks[seed];
  return `${hook} Today we're covering ${title}.`;
}

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

    // Headings
    if (line.startsWith('## ') || line.startsWith('### ')) {
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

function sectionToScene(
  section: MarkdownSection,
  language: string,
  currentFrame: number,
  sectionIndex: number = 0,
  topic: string = '',
): Scene {
  const type = mapSectionType(section.type);
  let narration = generateNarration(section);

  // Teaching Technique: Inject "aha moment" before key sections (every 3rd section)
  if (sectionIndex > 0 && sectionIndex % 3 === 0 && type !== 'text') {
    narration = `${getAhaPhrase(sectionIndex)} ${narration}`;
  }

  // Teaching Technique: Add encouragement before difficult sections (code, diagrams)
  if (sectionIndex > 2 && sectionIndex % 4 === 0 && (type === 'code' || type === 'diagram')) {
    narration = `${getEncouragement(sectionIndex)} ${narration}`;
  }

  // Teaching Technique: Reinforce key concept text sections with repetition
  if (type === 'text' && section.heading && narration.length > 80 && sectionIndex % 2 === 0) {
    // Extract first sentence as the concept to reinforce
    const firstSentence = narration.split(/[.!?]/)[0].trim();
    if (firstSentence.length > 20 && firstSentence.length < 200) {
      narration = reinforceConcept(firstSentence, topic);
    }
  }

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
  let narration: string;
  switch (section.type) {
    case 'code':
      narration = summarizeCode(section.content, section.language || 'typescript');
      break;
    case 'diagram':
      narration = `Let's visualize this with a diagram. ${section.heading || 'Here\'s how the components interact.'}`;
      break;
    case 'table':
      narration = `Let's compare these in a table. ${section.heading || 'Notice the key differences.'}`;
      break;
    case 'callout':
      narration = `Here's an important interview insight. ${section.content}`;
      break;
    case 'text':
    default:
      // Clean and use as narration directly
      narration = section.content
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links
        .replace(/[`*_#]/g, '') // Remove markdown formatting
        .slice(0, 500); // Cap length
      break;
  }
  return addTeachingPauses(narration);
}

function summarizeCode(code: string, language: string): string {
  const lines = code.split('\n').filter(l => l.trim());

  // Extract function/class names
  const funcMatch = code.match(/(?:function|def|public\s+\w+)\s+(\w+)/);
  const classMatch = code.match(/class\s+(\w+)/);

  // Use line-by-line walkthrough for longer code blocks (Fireship style)
  if (lines.length >= 4) {
    let intro = '';
    if (classMatch) {
      intro = `Let's look at the ${classMatch[1]} class in ${language}. `;
    } else if (funcMatch) {
      intro = `Here's the ${funcMatch[1]} function in ${language}. `;
    }
    return intro + generateCodeWalkthrough(code, language);
  }

  if (classMatch) {
    return `Let's look at the ${classMatch[1]} class. This ${language} implementation shows the key structure and methods you need to understand.`;
  }
  if (funcMatch) {
    return `Here's the ${funcMatch[1]} function in ${language}. Let's walk through this line by line to understand what's happening.`;
  }

  return `Let's examine this ${language} code. It has ${lines.length} lines and demonstrates a key concept. Pay attention to the logic flow.`;
}

// Add teaching pauses to narration for a more natural, teacher-like delivery
function addTeachingPauses(text: string): string {
  return text
    .replace(/\. /g, '... ')           // Pause after sentences
    .replace(/: /g, '... ')            // Pause after colons
    .replace(/\? /g, '?... ')          // Longer pause after questions
    .replace(/! /g, '!... ');          // Pause after exclamations
}

export {
  parseMarkdown,
  generateNarration,
  generateHook,
  addTeachingPauses,
  // Teaching technique exports
  getAnalogy,
  reinforceConcept,
  getAhaPhrase,
  getEncouragement,
  generateInterviewReality,
  generateCodeWalkthrough,
  describeCodeLine,
  ANALOGIES,
  AHA_PHRASES,
  ENCOURAGEMENT,
};
