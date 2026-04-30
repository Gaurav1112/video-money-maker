import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import type { VisualBeat } from '../../types';
import type { VisualTemplateConfig } from '../../lib/visual-templates';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface TemplateFactoryProps {
  templateId: string;
  variant: string;
  beats: VisualBeat[];
  accentColor: string;
  fps: number;
  sceneHeading?: string;
  bullets?: string[];
  content?: string;
}

// ---------------------------------------------------------------------------
// Layout type -> renderer mapping (lazy imports so missing files don't crash)
// Other agents are building these in parallel, so we guard each import.
// ---------------------------------------------------------------------------

type RendererComponent = React.FC<RendererProps>;

export interface RendererProps {
  templateId: string;
  variant: string;
  beats: VisualBeat[];
  accentColor: string;
  fps: number;
  sceneHeading?: string;
  bullets?: string[];
  content?: string;
  /** Auto-generated config for ConceptDiagram fallback */
  generatedConfig?: GeneratedConceptConfig;
  /** Config object passed to specialized renderers (architecture, flow, concept, etc.) */
  config?: any;
}

// ---------------------------------------------------------------------------
// Auto-generated concept diagram types
// ---------------------------------------------------------------------------
export interface ConceptBox {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ConceptArrow {
  from: string;
  to: string;
  label?: string;
}

export interface GeneratedConceptConfig {
  boxes: ConceptBox[];
  arrows: ConceptArrow[];
}

// ---------------------------------------------------------------------------
// Relationship keywords used to infer arrows from bullet text
// ---------------------------------------------------------------------------
const RELATIONSHIP_WORDS = [
  'to',
  'from',
  'connects',
  'sends',
  'receives',
  'forwards',
  'routes',
  'calls',
  'triggers',
  'returns',
  'passes',
  'flows',
  'pushes',
  'pulls',
  'writes',
  'reads',
];

// ---------------------------------------------------------------------------
// Lazy renderer cache (populated on first use per layout type)
// ---------------------------------------------------------------------------
const rendererCache: Record<string, RendererComponent | null> = {};

function tryLoadRenderer(layout: string): RendererComponent | null {
  if (layout in rendererCache) return rendererCache[layout];

  let Renderer: RendererComponent | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    switch (layout) {
      case 'architecture': {
        // Dynamic require wrapped in try-catch for parallel development
        const mod = require('./ArchitectureRenderer');
        Renderer = mod.ArchitectureRenderer ?? mod.default ?? null;
        break;
      }
      case 'flow': {
        const mod = require('./FlowRenderer');
        Renderer = mod.FlowRenderer ?? mod.default ?? null;
        break;
      }
      case 'concept':
      case 'data-structure': {
        const mod = require('./ConceptRenderer');
        Renderer = mod.ConceptRenderer ?? mod.default ?? null;
        break;
      }
      case 'comparison': {
        const mod = require('./ComparisonRenderer');
        Renderer = mod.ComparisonRenderer ?? mod.default ?? null;
        break;
      }
      case 'monitoring':
      case 'security': {
        const mod = require('./MonitoringRenderer');
        Renderer = mod.MonitoringRenderer ?? mod.default ?? null;
        break;
      }
      default:
        Renderer = null;
    }
  } catch {
    // Renderer not built yet -- fall through to generic fallback
    Renderer = null;
  }

  rendererCache[layout] = Renderer;
  return Renderer;
}

// ---------------------------------------------------------------------------
// Template registry lookup (import the full list to resolve layout type)
// ---------------------------------------------------------------------------
// We import the TEMPLATES array indirectly via the config type.
// To avoid circular deps, we maintain a lightweight id->layout map here
// that mirrors visual-templates.ts. This is intentionally denormalized so
// TemplateFactory stays self-contained.
// ---------------------------------------------------------------------------

const LAYOUT_BY_ID: Record<string, VisualTemplateConfig['layout']> = {
  // Architecture
  LoadBalancerArch: 'architecture',
  CacheArch: 'architecture',
  DatabaseArch: 'architecture',
  MicroservicesArch: 'architecture',
  MessageQueueArch: 'architecture',
  APIGatewayArch: 'architecture',
  DistributedArch: 'architecture',
  CQRSViz: 'architecture',
  EventDrivenViz: 'architecture',
  ServiceDiscoveryViz: 'architecture',
  ContainerOrchestrationViz: 'architecture',
  SearchEngineViz: 'architecture',
  BlobStorageViz: 'architecture',

  // Flow
  RequestFlow: 'flow',
  AuthFlow: 'flow',
  DataPipeline: 'flow',
  CIFlow: 'flow',
  NetworkFlow: 'flow',
  ConcurrencyControlViz: 'flow',
  SagaPatternViz: 'flow',
  CircuitBreakerViz: 'flow',
  BlueGreenCanaryViz: 'flow',
  FeatureFlagViz: 'flow',
  GraphQLViz: 'flow',
  GRPCViz: 'flow',
  MapReduceViz: 'flow',
  SparkStreamViz: 'flow',
  KafkaStreamsViz: 'flow',

  // Comparison
  VSBattle: 'comparison',
  ScaleComparison: 'comparison',
  BeforeAfter: 'comparison',
  APIVersioningViz: 'comparison',
  DataSerializationViz: 'comparison',

  // Concept
  HashRing: 'concept',
  TreeVisualization: 'concept',
  GraphVisualization: 'concept',
  ThreadPoolViz: 'concept',
  MutexSemaphoreViz: 'concept',
  DeadlockViz: 'concept',
  RateLimiterViz: 'concept',
  PaginationViz: 'concept',
  FileSystemViz: 'concept',
  LeaderElectionViz: 'concept',
  GossipProtocolViz: 'concept',
  VectorClockViz: 'concept',
  RaftConsensusViz: 'concept',

  // Data structure
  BloomFilterViz: 'data-structure',
  LRUCacheViz: 'data-structure',
  SkipListViz: 'data-structure',
  MerkleTreeViz: 'data-structure',
  BTreeViz: 'data-structure',

  // Monitoring
  ChaosEngineeringViz: 'monitoring',
  LoggingTracingViz: 'monitoring',
  MonitoringAlertViz: 'monitoring',

  // Security
  OAuthJWTViz: 'security',

  // Generic
  ConceptDiagram: 'generic',
  IconGrid: 'generic',
};

// ---------------------------------------------------------------------------
// Auto-generate a concept diagram config from bullets
// ---------------------------------------------------------------------------
function generateConceptConfig(bullets: string[]): GeneratedConceptConfig {
  const boxes: ConceptBox[] = [];
  const arrows: ConceptArrow[] = [];

  const BOX_W = 260;
  const BOX_H = 60;
  const GAP_Y = 90;
  const CENTER_X = 960 - BOX_W / 2; // center of 1920 canvas

  bullets.forEach((bullet, i) => {
    const id = `box-${i}`;
    boxes.push({
      id,
      label: bullet.replace(/^[-*]\s*/, '').trim(),
      x: CENTER_X,
      y: 100 + i * GAP_Y,
      width: BOX_W,
      height: BOX_H,
    });
  });

  // Infer arrows from relationship words
  for (let i = 0; i < bullets.length; i++) {
    const lower = bullets[i].toLowerCase();
    for (const word of RELATIONSHIP_WORDS) {
      const regex = new RegExp(`\\b${word}\\b`);
      if (regex.test(lower) && i + 1 < bullets.length) {
        arrows.push({ from: `box-${i}`, to: `box-${i + 1}`, label: word });
        break; // one arrow per bullet
      }
    }
  }

  // If no arrows were inferred, create a simple top-down chain
  if (arrows.length === 0 && boxes.length > 1) {
    for (let i = 0; i < boxes.length - 1; i++) {
      arrows.push({ from: `box-${i}`, to: `box-${i + 1}` });
    }
  }

  return { boxes, arrows };
}

// ---------------------------------------------------------------------------
// Fallback renderer -- simple animated box layout
// ---------------------------------------------------------------------------
const FallbackRenderer: React.FC<RendererProps> = ({
  beats,
  accentColor,
  fps,
  sceneHeading,
  generatedConfig,
}) => {
  const frame = useCurrentFrame();
  const config = generatedConfig;

  if (!config || config.boxes.length === 0) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#0C0A15',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {sceneHeading && (
          <div
            style={{
              color: accentColor,
              fontSize: 48,
              fontWeight: 700,
              fontFamily: 'Inter, sans-serif',
              textAlign: 'center',
              padding: 40,
            }}
          >
            {sceneHeading}
          </div>
        )}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#0C0A15' }}>
      {/* Heading */}
      {sceneHeading && (
        <div
          style={{
            position: 'absolute',
            top: 30,
            left: 0,
            right: 0,
            textAlign: 'center',
            color: accentColor,
            fontSize: 36,
            fontWeight: 700,
            fontFamily: 'Inter, sans-serif',
            opacity: interpolate(frame, [0, fps * 0.3], [0, 1], {
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {sceneHeading}
        </div>
      )}

      {/* Boxes */}
      {config.boxes.map((box, idx) => {
        const enterFrame = idx * (fps * 0.2);
        const opacity = interpolate(
          frame,
          [enterFrame, enterFrame + fps * 0.3],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );
        const translateY = interpolate(
          frame,
          [enterFrame, enterFrame + fps * 0.3],
          [20, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );

        // Highlight the box if a beat references it
        const activeBeat = beats.find(
          (b) =>
            frame >= b.startTime * fps &&
            frame < b.endTime * fps &&
            b.text.toLowerCase().includes(box.label.toLowerCase().slice(0, 10)),
        );

        return (
          <div
            key={box.id}
            style={{
              position: 'absolute',
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
              backgroundColor: activeBeat
                ? accentColor
                : 'rgba(255,255,255,0.06)',
              border: `2px solid ${activeBeat ? accentColor : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: activeBeat ? '#0C0A15' : '#E0E0E0',
              fontSize: 18,
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              opacity,
              transform: `translateY(${translateY}px)`,
              transition: 'background-color 0.3s, border-color 0.3s',
              padding: '0 12px',
              textAlign: 'center',
            }}
          >
            {box.label}
          </div>
        );
      })}

      {/* Arrows (simple vertical lines) */}
      {config.arrows.map((arrow, idx) => {
        const fromBox = config.boxes.find((b) => b.id === arrow.from);
        const toBox = config.boxes.find((b) => b.id === arrow.to);
        if (!fromBox || !toBox) return null;

        const fromY = fromBox.y + fromBox.height;
        const toY = toBox.y;
        const centerX = fromBox.x + fromBox.width / 2;
        const arrowLen = toY - fromY;

        const enterFrame = (idx + 1) * (fps * 0.2);
        const opacity = interpolate(
          frame,
          [enterFrame, enterFrame + fps * 0.2],
          [0, 0.6],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );

        return (
          <React.Fragment key={`arrow-${idx}`}>
            <div
              style={{
                position: 'absolute',
                left: centerX - 1,
                top: fromY,
                width: 2,
                height: Math.max(0, arrowLen),
                backgroundColor: accentColor,
                opacity,
              }}
            />
            {/* Arrow tip */}
            <div
              style={{
                position: 'absolute',
                left: centerX - 6,
                top: toY - 8,
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: `8px solid ${accentColor}`,
                opacity,
              }}
            />
            {/* Arrow label */}
            {arrow.label && (
              <div
                style={{
                  position: 'absolute',
                  left: centerX + 8,
                  top: fromY + arrowLen / 2 - 8,
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 12,
                  fontFamily: 'Inter, sans-serif',
                  opacity,
                }}
              >
                {arrow.label}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// TemplateFactory -- the ONE component that dispatches to the right renderer
// ---------------------------------------------------------------------------
export const TemplateFactory: React.FC<TemplateFactoryProps> = (props) => {
  const {
    templateId,
    variant,
    beats,
    accentColor,
    fps,
    sceneHeading,
    bullets,
    content,
  } = props;

  // 1. Resolve layout type from templateId
  const layout = LAYOUT_BY_ID[templateId] ?? 'generic';

  // 2. Try to load the specialised renderer for this layout
  const Renderer = layout !== 'generic' ? tryLoadRenderer(layout) : null;

  // 3. Build renderer props
  const rendererProps: RendererProps = {
    templateId,
    variant,
    beats,
    accentColor,
    fps,
    sceneHeading,
    bullets,
    content,
  };

  // 4. If no specialised renderer, auto-generate concept config from bullets
  if (!Renderer) {
    const effectiveBullets =
      bullets && bullets.length > 0
        ? bullets
        : content
          ? content
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean)
          : sceneHeading
            ? [sceneHeading]
            : [];

    rendererProps.generatedConfig = generateConceptConfig(effectiveBullets);
    return <FallbackRenderer {...rendererProps} />;
  }

  // 5. Load config for the specialised renderer and pass it
  // Each renderer type has its own config format. We load the config
  // from the appropriate configs file and pass it as a prop.
  try {
    if (layout === 'architecture') {
      const { ARCHITECTURE_CONFIGS } = require('./architecture-configs');
      const configMap = ARCHITECTURE_CONFIGS[templateId];
      const config = configMap?.[variant] ?? configMap?.overview ?? Object.values(configMap || {})[0];
      if (config) {
        return <Renderer {...rendererProps} config={config} />;
      }
    } else if (layout === 'flow') {
      const { FLOW_CONFIGS } = require('./flow-configs');
      const configMap = FLOW_CONFIGS[templateId];
      const config = configMap?.[variant] ?? configMap?.overview ?? Object.values(configMap || {})[0];
      if (config) {
        return <Renderer {...rendererProps} config={config} />;
      }
    } else if (layout === 'concept' || layout === 'data-structure') {
      const { CONCEPT_CONFIGS } = require('./concept-configs');
      const configMap = CONCEPT_CONFIGS[templateId];
      const config = configMap?.[variant] ?? configMap?.overview ?? Object.values(configMap || {})[0];
      if (config) {
        return <Renderer {...rendererProps} config={config} />;
      }
    } else if (layout === 'comparison') {
      const { COMPARISON_CONFIGS } = require('./comparison-configs');
      const configMap = COMPARISON_CONFIGS[templateId];
      const config = configMap?.[variant] ?? configMap?.overview ?? Object.values(configMap || {})[0];
      if (config) {
        return <Renderer {...rendererProps} config={config} />;
      }
    } else if (layout === 'monitoring' || layout === 'security') {
      const { MONITORING_CONFIGS } = require('./monitoring-configs');
      const configMap = MONITORING_CONFIGS[templateId];
      const config = configMap?.[variant] ?? configMap?.overview ?? Object.values(configMap || {})[0];
      if (config) {
        return <Renderer {...rendererProps} config={config} />;
      }
    }
  } catch {
    // Config not found — fall through to fallback
  }

  // If config not found, use fallback renderer
  const effectiveBullets =
    bullets && bullets.length > 0
      ? bullets
      : sceneHeading
        ? [sceneHeading]
        : [];
  rendererProps.generatedConfig = generateConceptConfig(effectiveBullets);
  return <FallbackRenderer {...rendererProps} />;
};

export default TemplateFactory;
