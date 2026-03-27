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

  return scenes;
}

function generateHook(topic: string, title: string): string {
  const hooks = [
    `Did you know most developers struggle with ${topic}? Today we're going to change that.`,
    `${topic} is one of the most asked topics in technical interviews. Let's master it.`,
    `If you want to ace your next interview, you need to understand ${topic}. Let's dive in.`,
    `Here's what separates junior from senior developers: understanding ${topic}. Let's break it down.`,
  ];
  // Deterministic selection based on topic+title to ensure reproducible builds
  const seed = topic.length + title.length;
  const hook = hooks[seed % hooks.length];
  return `${hook} Today's lesson: ${title}.`;
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
  switch (section.type) {
    case 'code':
      return summarizeCode(section.content, section.language || 'typescript');
    case 'diagram':
      return `Let's visualize this with a diagram. ${section.heading || 'Here\'s how the components interact.'}`;
    case 'table':
      return `Let's compare these in a table. ${section.heading || 'Notice the key differences.'}`;
    case 'callout':
      return `Here's an important interview insight. ${section.content}`;
    case 'text':
    default:
      // Clean and use as narration directly
      return section.content
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links
        .replace(/[`*_#]/g, '') // Remove markdown formatting
        .slice(0, 500); // Cap length
  }
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

export { parseMarkdown, generateNarration, generateHook };
