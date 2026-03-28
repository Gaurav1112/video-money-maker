import { SessionInput, Scene, SceneType } from '../types';
import { NARRATION_SPEEDS, SCENE_DEFAULTS, TIMING } from '../lib/constants';
import { renderMermaidToSvg } from './mermaid-renderer';

interface ScriptOptions {
  language?: string; // 'python' | 'java' -- which code examples to use
  maxScenes?: number;
}

export function generateScript(session: SessionInput, options: ScriptOptions = {}): Scene[] {
  const { language = 'python', maxScenes = 20 } = options;
  const scenes: Scene[] = [];
  let currentFrame = 0;

  // 1. Hook + Title Scene (Khan GS style: start with WHY)
  const hookNarration = generateHook(session.topic, session.title);
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

    const scene = sectionToScene(section, language, currentFrame);
    scenes.push(scene);
    currentFrame = scene.endFrame;
  }

  // 3. Review Questions (if any)
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

  // 4. Summary Scene
  const summaryDuration = SCENE_DEFAULTS.summaryDuration;
  scenes.push({
    type: 'summary',
    content: 'Key Takeaways',
    narration: `Let's recap what we learned. ${session.objectives.slice(0, 3).join('. ')}. Practice these concepts and you'll ace your interview.`,
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

function sectionToScene(section: MarkdownSection, language: string, currentFrame: number): Scene {
  const type = mapSectionType(section.type);
  const narration = generateNarration(section);
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

export { parseMarkdown, generateNarration, generateHook, addTeachingPauses };
