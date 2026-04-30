import React from 'react';
import {
  useCurrentFrame,
  AbsoluteFill,
  interpolate,
  spring,
  useVideoConfig,
  staticFile,
  Img,
} from 'remotion';
import { COLORS, FONTS } from '../lib/theme';
import { TemplateFactory } from './templates/TemplateFactory';
import { SketchDiagram } from './viz/SketchDiagram';
import { getVisualTemplate } from '../lib/visual-templates';
import { computeVisualBeats } from '../lib/visual-beats';
import { getBackgroundImage } from '../lib/bg-images';
import { TerminalScene } from './scenes/TerminalScene';
import { BrowserScene } from './scenes/BrowserScene';
import { DashboardScene } from './scenes/DashboardScene';
import type { AnimationCue, VisualBeat } from '../types';
import type { SketchNode, SketchEdge } from './viz/SketchDiagram';

// ---------------------------------------------------------------------------
// Sketch diagram data resolver — converts architecture/flow configs to sketch format
// ---------------------------------------------------------------------------
function getSketchDiagramData(
  templateId: string,
  variant: string,
): { nodes: SketchNode[]; edges: SketchEdge[]; title?: string } | null {
  try {
    // Check architecture configs
    const { ARCHITECTURE_CONFIGS } = require('./templates/architecture-configs');
    const archConfigMap = ARCHITECTURE_CONFIGS[templateId];
    if (archConfigMap) {
      const config = archConfigMap[variant] ?? archConfigMap.overview ?? Object.values(archConfigMap)[0];
      if (config) {
        const nodes: SketchNode[] = config.nodes.map((n: any) => ({
          id: n.id,
          label: n.label,
          x: n.x,
          y: n.y,
          width: n.width,
          height: n.height,
          color: n.color,
          beatIndex: n.beatIndex,
        }));
        const edges: SketchEdge[] = config.edges.map((e: any) => ({
          from: e.from,
          to: e.to,
          label: e.label,
          dashed: e.dashed,
          beatIndex: e.beatIndex,
        }));
        return { nodes, edges, title: config.title };
      }
    }

    // Check flow configs — convert linear stages to nodes + edges
    const { FLOW_CONFIGS } = require('./templates/flow-configs');
    const flowConfig = FLOW_CONFIGS[templateId];
    if (flowConfig) {
      const stages = flowConfig.stages || [];
      const count = stages.length;
      const nodes: SketchNode[] = stages.map((s: any, i: number) => ({
        id: s.id,
        label: s.label,
        x: 8 + (i / Math.max(1, count - 1)) * 84,
        y: 45,
        width: 160,
        height: 70,
        color: s.color,
        icon: s.description ? undefined : undefined,
        beatIndex: s.beatIndex,
      }));
      const edges: SketchEdge[] = [];
      for (let i = 0; i < count - 1; i++) {
        edges.push({
          from: stages[i].id,
          to: stages[i + 1].id,
          beatIndex: stages[i + 1].beatIndex,
        });
      }
      return { nodes, edges, title: flowConfig.title };
    }
  } catch {
    // Configs not available — fall through
  }
  return null;
}

// ---------------------------------------------------------------------------
// Props — EXTENDS original interface with new optional fields
// ---------------------------------------------------------------------------
interface TextSectionProps {
  heading?: string;
  bullets?: string[];
  content?: string;
  narration?: string;
  startFrame?: number;
  endFrame?: number;
  sceneIndex?: number;
  sceneStartFrame?: number;
  animationCues?: AnimationCue[];
  // New visual-template props (all optional for backward compat)
  visualBeats?: VisualBeat[];
  templateId?: string;
  templateVariant?: string;
  accentColor?: string;
  topic?: string;
  /** Pre-rendered D2 SVG string (from storyboard phase) */
  d2Svg?: string;
}

// ---------------------------------------------------------------------------
// Scene type auto-detection keywords
// ---------------------------------------------------------------------------
const TERMINAL_KEYWORDS = ['terminal', 'command', 'docker', 'deploy', 'install', 'run', 'kubectl', 'bash', 'npm', 'pip', 'shell', 'cli', 'ssh', 'git'];
const BROWSER_KEYWORDS = ['api', 'response', 'endpoint', 'url', 'http', 'request', 'json', 'rest', 'graphql', 'webhook', 'browser'];
const DASHBOARD_KEYWORDS = ['monitor', 'metric', 'performance', 'latency', 'throughput', 'health', 'dashboard', 'alert', 'observability', 'grafana', 'prometheus'];

function detectSceneStyle(heading: string): 'terminal' | 'browser' | 'dashboard' | null {
  const h = heading.toLowerCase();
  if (TERMINAL_KEYWORDS.some(k => h.includes(k))) return 'terminal';
  if (BROWSER_KEYWORDS.some(k => h.includes(k))) return 'browser';
  if (DASHBOARD_KEYWORDS.some(k => h.includes(k))) return 'dashboard';
  return null;
}

/**
 * Generate terminal commands from scene bullets/narration.
 */
function generateTerminalCommands(
  heading: string,
  bullets: string[],
  narration: string,
): Array<{ cmd: string; output: string }> {
  const commands: Array<{ cmd: string; output: string }> = [];
  const h = heading.toLowerCase();

  // Use bullets as basis for commands if available
  if (bullets.length > 0) {
    for (const bullet of bullets.slice(0, 4)) {
      commands.push({
        cmd: `echo "${bullet.slice(0, 60)}"`,
        output: bullet,
      });
    }
    return commands;
  }

  // Generate context-appropriate commands
  if (h.includes('docker')) {
    commands.push(
      { cmd: 'docker ps', output: 'CONTAINER ID   IMAGE          STATUS\na1b2c3d4       nginx:latest   Up 3 hours\ne5f6g7h8       redis:alpine   Up 3 hours' },
      { cmd: 'docker logs a1b2c3d4', output: '[notice] nginx started successfully' },
    );
  } else if (h.includes('kubectl') || h.includes('kubernetes')) {
    commands.push(
      { cmd: 'kubectl get pods', output: 'NAME                  READY   STATUS    RESTARTS   AGE\napp-6d4f5b8-x7z9k    1/1     Running   0          2h\ndb-8c3e2a1-m4n6p     1/1     Running   0          2h' },
      { cmd: 'kubectl get services', output: 'NAME         TYPE        CLUSTER-IP     PORT(S)\napp-svc      ClusterIP   10.0.0.42      8080/TCP\ndb-svc       ClusterIP   10.0.0.88      5432/TCP' },
    );
  } else if (h.includes('npm') || h.includes('install')) {
    commands.push(
      { cmd: 'npm install', output: 'added 847 packages in 12s\n\n142 packages are looking for funding' },
      { cmd: 'npm run build', output: '✓ Compiled successfully in 3.2s\n✓ Build output: dist/' },
    );
  } else if (h.includes('git')) {
    commands.push(
      { cmd: 'git status', output: 'On branch main\nYour branch is up to date.\n\nChanges to be committed:\n  modified:   src/app.ts' },
      { cmd: 'git log --oneline -3', output: 'a1b2c3d feat: add load balancer\ne4f5g6h fix: connection pool\ni7j8k9l refactor: cache layer' },
    );
  } else {
    // Generic: use first sentence of narration
    const firstSentence = narration.split(/[.!?]/)[0]?.trim() || heading;
    commands.push(
      { cmd: `# ${heading}`, output: firstSentence },
    );
  }

  return commands;
}

/**
 * Generate browser content from scene data.
 */
function generateBrowserContent(
  heading: string,
  bullets: string[],
  narration: string,
): { url: string; content: string; title: string } {
  const h = heading.toLowerCase();

  let url = 'https://api.example.com';
  let title = heading;

  if (h.includes('api') || h.includes('endpoint') || h.includes('rest')) {
    url = 'https://api.guru-sishya.in/v1/health';
  } else if (h.includes('graphql')) {
    url = 'https://api.guru-sishya.in/graphql';
  } else if (h.includes('webhook')) {
    url = 'https://hooks.guru-sishya.in/events';
  }

  // Build JSON-like response from bullets
  if (bullets.length > 0) {
    const jsonObj: Record<string, string> = { status: 'success' };
    bullets.slice(0, 4).forEach((b, i) => {
      const key = b.split(/[:\-—]/)[0]?.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 20) || `field_${i}`;
      const val = b.split(/[:\-—]/)[1]?.trim() || b;
      jsonObj[key] = val;
    });
    return {
      url,
      title,
      content: JSON.stringify(jsonObj, null, 2),
    };
  }

  return {
    url,
    title,
    content: JSON.stringify({
      status: 'ok',
      message: narration.split(/[.!?]/)[0]?.trim() || heading,
      timestamp: '2026-04-02T10:30:00Z',
    }, null, 2),
  };
}

/**
 * Generate dashboard metrics from scene data.
 */
function generateDashboardMetrics(
  heading: string,
  bullets: string[],
): Array<{ label: string; value: number; unit?: string; color?: string; trend?: 'up' | 'down' | 'stable' }> {
  const h = heading.toLowerCase();

  // Try to extract numbers from bullets
  if (bullets.length >= 2) {
    return bullets.slice(0, 4).map((b, i) => {
      const numMatch = b.match(/(\d+(?:\.\d+)?)/);
      const value = numMatch ? parseFloat(numMatch[1]) : (i + 1) * 250;
      const label = b.split(/[:\-—\d]/)[0]?.trim() || `Metric ${i + 1}`;
      const colors = ['#60A5FA', '#4ADE80', '#FBBF24', '#F87171'];
      const trends: Array<'up' | 'down' | 'stable'> = ['up', 'up', 'stable', 'down'];
      return {
        label,
        value,
        unit: h.includes('latency') ? 'ms' : h.includes('throughput') ? 'req/s' : '',
        color: colors[i % 4],
        trend: trends[i % 4],
      };
    });
  }

  // Default metrics based on heading context
  if (h.includes('latency') || h.includes('performance')) {
    return [
      { label: 'P50 Latency', value: 45, unit: 'ms', color: '#4ADE80', trend: 'down' as const },
      { label: 'P99 Latency', value: 230, unit: 'ms', color: '#FBBF24', trend: 'stable' as const },
      { label: 'Throughput', value: 12500, unit: 'req/s', color: '#60A5FA', trend: 'up' as const },
      { label: 'Error Rate', value: 0.2, unit: '%', color: '#F87171', trend: 'down' as const },
    ];
  }

  return [
    { label: 'Requests/sec', value: 8400, unit: 'req/s', color: '#60A5FA', trend: 'up' as const },
    { label: 'Avg Response', value: 42, unit: 'ms', color: '#4ADE80', trend: 'down' as const },
    { label: 'Uptime', value: 99.9, unit: '%', color: '#4ADE80', trend: 'stable' as const },
    { label: 'Active Connections', value: 1250, unit: '', color: '#FBBF24', trend: 'up' as const },
  ];
}

// =============================
// MAIN COMPONENT
// =============================
const TextSection: React.FC<TextSectionProps> = ({
  heading = '',
  bullets = [],
  content = '',
  narration = '',
  startFrame = 0,
  endFrame = 300,
  sceneIndex,
  sceneStartFrame,
  animationCues,
  visualBeats: visualBeatsProp,
  templateId: templateIdProp,
  templateVariant: templateVariantProp,
  accentColor: accentColorProp,
  topic = '',
  d2Svg,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // -------------------------------------------------------------------
  // 1. Resolve template — either from props or auto-select
  // -------------------------------------------------------------------
  let templateId = templateIdProp || '';
  let templateVariant = templateVariantProp || 'overview';
  let accentColor = accentColorProp || COLORS.saffron;

  if (!templateId) {
    // Auto-select template from heading + topic keywords
    const auto = getVisualTemplate(
      topic,
      sceneIndex ?? 0,
      heading,
      'text',
    );
    templateId = auto.templateId;
    templateVariant = auto.variant;
    accentColor = auto.accentColor;
  }

  // -------------------------------------------------------------------
  // 2. Resolve visual beats — either from props or compute from narration
  // -------------------------------------------------------------------
  let beats: VisualBeat[] = visualBeatsProp || [];
  if (beats.length === 0 && narration) {
    // No word timestamps available at this level — build simple beats
    // by splitting narration into sentences with estimated timing
    const sentences = narration
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    const sceneDurationSec = (endFrame - startFrame) / fps;
    const timePerSentence = sceneDurationSec / Math.max(1, sentences.length);

    beats = sentences.map((text, i) => ({
      startTime: i * timePerSentence,
      endTime: (i + 1) * timePerSentence,
      text,
      beatIndex: i,
      totalBeats: sentences.length,
      keywords: [],
    }));
  }

  // -------------------------------------------------------------------
  // 2.5. Detect scene style — terminal, browser, dashboard, or default
  // -------------------------------------------------------------------
  const detectedStyle = detectSceneStyle(heading);

  // If a software-environment style is detected, render that instead of the
  // standard template layout. Return early to avoid rendering the default.
  if (detectedStyle === 'terminal') {
    const commands = generateTerminalCommands(heading, bullets, narration);
    return (
      <TerminalScene
        commands={commands}
        title={`Terminal — ${heading}`}
        prompt="$ "
        startFrame={startFrame}
        sceneIndex={sceneIndex}
        sceneDurationFrames={endFrame - startFrame}
      />
    );
  }

  if (detectedStyle === 'browser') {
    const browserData = generateBrowserContent(heading, bullets, narration);
    return (
      <BrowserScene
        url={browserData.url}
        content={browserData.content}
        title={browserData.title}
        startFrame={startFrame}
        sceneIndex={sceneIndex}
        sceneDurationFrames={endFrame - startFrame}
      />
    );
  }

  if (detectedStyle === 'dashboard') {
    const metrics = generateDashboardMetrics(heading, bullets);
    return (
      <DashboardScene
        metrics={metrics}
        title={`${heading} — Production`}
        startFrame={startFrame}
        sceneIndex={sceneIndex}
        sceneDurationFrames={endFrame - startFrame}
      />
    );
  }

  // -------------------------------------------------------------------
  // 3. Background image (subtle, 8% opacity)
  // -------------------------------------------------------------------
  const bgImagePath = getBackgroundImage('text');

  // -------------------------------------------------------------------
  // 4. Chapter marker animation (small heading, top-left)
  // -------------------------------------------------------------------
  const chapterOpacity = interpolate(frame, [0, 20], [0, 0.7], {
    extrapolateRight: 'clamp',
  });
  const chapterX = interpolate(frame, [0, 20], [-20, 0], {
    extrapolateRight: 'clamp',
  });

  // -------------------------------------------------------------------
  // 5. Template entrance animation
  // -------------------------------------------------------------------
  const templateEntrance = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 18, stiffness: 80, mass: 1 },
  });
  const templateScale = interpolate(templateEntrance, [0, 1], [0.95, 1]);
  const templateOpacity = interpolate(templateEntrance, [0, 1], [0, 1]);

  // -------------------------------------------------------------------
  // 6. Scene progress bar
  // -------------------------------------------------------------------
  const sceneDuration = endFrame - startFrame;
  const progressPercent = Math.min(100, (frame / sceneDuration) * 100);

  return (
    <AbsoluteFill
      style={{
        background: COLORS.dark,
        fontFamily: FONTS.text,
        overflow: 'hidden',
      }}
    >
      {/* Subtle light background grid */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }} />
      </div>

      {/* ===== BACKGROUND IMAGE — 8% opacity ===== */}
      {bgImagePath && (
        <Img
          src={staticFile(bgImagePath)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.08,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ===== FULL-SCREEN TEMPLATE — wrapped in card ===== */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${templateScale})`,
          opacity: templateOpacity,
          padding: 24,
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 32,
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            border: '1px solid #E2E0DC',
            width: '100%',
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
        {/* Scene heading overlay — below TopicHeader (44px marquee + 36px header = 80px) */}
        {heading && (
          <div style={{
            position: 'absolute',
            top: 56,
            left: 24,
            right: 24,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{
              width: 4,
              height: 28,
              backgroundColor: accentColor,
              borderRadius: 2,
            }} />
            <span style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#1E293B',
              fontFamily: 'Space Grotesk, Inter, sans-serif',
              letterSpacing: '-0.3px',
            }}>
              {heading}
            </span>
          </div>
        )}

        {(() => {
          // Priority 1: Pre-rendered D2 SVG diagram (professional, deterministic)
          if (d2Svg) {
            const revealPercent = interpolate(
              frame,
              [0, Math.max(1, sceneDuration * 0.6)],
              [0, 100],
              { extrapolateRight: 'clamp' },
            );
            return (
              <div
                style={{
                  position: 'absolute',
                  top: 240,
                  left: 40,
                  right: 40,
                  bottom: 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  dangerouslySetInnerHTML={{ __html: d2Svg }}
                  style={{
                    maxWidth: '90%',
                    maxHeight: '100%',
                    clipPath: `inset(0 ${100 - revealPercent}% 0 0)`,
                    transition: 'clip-path 0.5s ease-out',
                  }}
                />
              </div>
            );
          }

          // Priority 2: SketchDiagram from architecture/flow configs
          const sketchData = getSketchDiagramData(templateId, templateVariant);
          if (sketchData) {
            return (
              <SketchDiagram
                nodes={sketchData.nodes}
                edges={sketchData.edges}
                beats={beats}
                fps={fps}
                accentColor={accentColor}
                title={sketchData.title}
              />
            );
          }

          // Priority 3: TemplateFactory (57 CSS-based templates)
          return (
            <TemplateFactory
              templateId={templateId}
              variant={templateVariant}
              beats={beats}
              accentColor={accentColor}
              fps={fps}
              sceneHeading={heading}
              bullets={bullets.length > 0 ? bullets : undefined}
              content={content || undefined}
            />
          );
        })()}
        </div>
      </div>

      {/* ===== CHAPTER MARKER — small heading, top-left ===== */}
      {heading && (
        <div
          style={{
            position: 'absolute',
            top: 56,
            left: 32,
            zIndex: 10,
            opacity: chapterOpacity,
            transform: `translateX(${chapterX}px)`,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: COLORS.saffron,
              fontFamily: FONTS.heading,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              textShadow: 'none',
            }}
          >
            {heading}
          </div>
        </div>
      )}

      {/* ===== SCENE PROGRESS BAR — thin line at bottom ===== */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: `${progressPercent}%`,
          height: 2,
          background: `linear-gradient(90deg, ${accentColor}80, ${accentColor})`,
          zIndex: 10,
        }}
      />
    </AbsoluteFill>
  );
};

export default TextSection;
