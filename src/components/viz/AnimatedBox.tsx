import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from 'remotion';
import { COLORS, FONTS } from '../../lib/theme';
import { getWobble } from '../../lib/wobble';
import {
  Server, Database, Cloud, Globe, Shield, Cpu, HardDrive,
  Network, Layers, GitBranch, Container, Scale, ListOrdered,
  Monitor, Lock, Wifi, Radio, Gauge, Search, FileText,
  BarChart3, Boxes, Workflow, Zap, AlertTriangle, CheckCircle,
} from 'lucide-react';

// Map keywords to Lucide icons
const ICON_MAP: Record<string, React.FC<any>> = {
  'server': Server, 'service': Server, 'app': Server, 'backend': Server,
  'database': Database, 'db': Database, 'primary': Database, 'replica': Database,
  'sql': Database, 'nosql': Database, 'postgres': Database, 'mysql': Database,
  'cache': HardDrive, 'redis': HardDrive, 'memcached': HardDrive, 'ttl': HardDrive,
  'cloud': Cloud, 'aws': Cloud, 'gcp': Cloud, 'azure': Cloud,
  'gateway': Shield, 'api': Shield, 'proxy': Shield, 'nginx': Shield,
  'load': Scale, 'balancer': Scale, 'round robin': Scale,
  'client': Monitor, 'user': Monitor, 'browser': Monitor, 'web': Monitor, 'mobile': Monitor,
  'queue': ListOrdered, 'kafka': ListOrdered, 'rabbit': ListOrdered, 'message': ListOrdered,
  'producer': Radio, 'consumer': Cpu,
  'cdn': Globe, 'dns': Globe, 'domain': Globe,
  'network': Network, 'tcp': Network, 'http': Network,
  'container': Container, 'docker': Container, 'pod': Container, 'k8s': Container,
  'auth': Lock, 'jwt': Lock, 'oauth': Lock, 'session': Lock, 'token': Lock,
  'monitor': Gauge, 'metric': Gauge, 'alert': Gauge, 'grafana': Gauge,
  'search': Search, 'elastic': Search, 'index': Search,
  'log': FileText, 'trace': FileText,
  'shard': Boxes, 'partition': Boxes,
  'flow': Workflow, 'pipeline': Workflow, 'etl': Workflow,
  'fast': Zap, 'quick': Zap, 'speed': Zap,
  'error': AlertTriangle, 'fail': AlertTriangle, 'crash': AlertTriangle,
  'success': CheckCircle, 'health': CheckCircle, 'check': CheckCircle,
  'layer': Layers, 'tier': Layers,
  'node': GitBranch, 'cluster': GitBranch,
  'wireless': Wifi, 'signal': Wifi,
  'stat': BarChart3, 'chart': BarChart3, 'dashboard': BarChart3,
};

function getIcon(label: string): React.FC<any> | null {
  const lower = label.toLowerCase();
  for (const [key, Icon] of Object.entries(ICON_MAP)) {
    if (lower.includes(key)) return Icon;
  }
  return Server; // default
}

// Color presets for different node types
const COLOR_PRESETS: Record<string, { bg: string; border: string; icon: string }> = {
  default: { bg: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', border: 'rgba(139,92,246,0.3)', icon: '#a78bfa' },
  green: { bg: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', border: 'rgba(16,185,129,0.3)', icon: '#6ee7b7' },
  blue: { bg: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)', border: 'rgba(96,165,250,0.3)', icon: '#93c5fd' },
  orange: { bg: 'linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)', border: 'rgba(251,146,60,0.3)', icon: '#fdba74' },
  purple: { bg: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', border: 'rgba(139,92,246,0.3)', icon: '#a78bfa' },
  teal: { bg: 'linear-gradient(135deg, #134e4a 0%, #115e59 100%)', border: 'rgba(45,212,191,0.3)', icon: '#5eead4' },
  red: { bg: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)', border: 'rgba(248,113,113,0.3)', icon: '#fca5a5' },
  gold: { bg: 'linear-gradient(135deg, #713f12 0%, #854d0e 100%)', border: 'rgba(253,224,71,0.3)', icon: '#fde047' },
};

function getColorPreset(color?: string): { bg: string; border: string; icon: string } {
  if (!color) return COLOR_PRESETS.default;
  const c = color.toLowerCase();
  if (c.includes('1dd1a1') || c.includes('teal') || c.includes('green')) return COLOR_PRESETS.green;
  if (c.includes('60a5fa') || c.includes('blue') || c.includes('3498')) return COLOR_PRESETS.blue;
  if (c.includes('e85d26') || c.includes('saffron') || c.includes('ff9900') || c.includes('orange')) return COLOR_PRESETS.orange;
  if (c.includes('a78bfa') || c.includes('818cf8') || c.includes('purple') || c.includes('8e44')) return COLOR_PRESETS.purple;
  if (c.includes('ef4444') || c.includes('e74c3c') || c.includes('red')) return COLOR_PRESETS.red;
  if (c.includes('fdb813') || c.includes('ffd700') || c.includes('gold')) return COLOR_PRESETS.gold;
  return COLOR_PRESETS.default;
}

interface AnimatedBoxProps {
  label: string;
  iconSlug?: string | null;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  isActive?: boolean;
  entryFrame: number;
  fps?: number;
}

export const AnimatedBox: React.FC<AnimatedBoxProps> = ({
  label,
  iconSlug,
  x, y,
  width = 180,
  height = 70,
  color,
  isActive = false,
  entryFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const age = frame - entryFrame;
  if (age < 0) return null;

  const entrance = spring({ frame: age, fps, config: { damping: 14, stiffness: 120, mass: 0.8 } });
  const scale = interpolate(entrance, [0, 1], [0.85, 1.0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  const wobble = getWobble(frame, Math.round(x + y));
  const preset = getColorPreset(color);
  const IconComponent = getIcon(label);

  return (
    <div style={{
      position: 'absolute',
      left: x - width / 2,
      top: y - height / 2,
      width, height,
      transform: `scale(${scale}) translate(${wobble.x}px, ${wobble.y}px) rotate(${wobble.rotate}deg)`,
      opacity,
      background: preset.bg,
      borderRadius: 16,
      border: `1px solid ${isActive ? preset.icon : preset.border}`,
      boxShadow: isActive
        ? `0 0 24px ${preset.icon}44, 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`
        : `0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: '0 16px',
      transition: 'box-shadow 0.3s, border-color 0.3s',
    }}>
      {IconComponent && (
        <IconComponent size={24} color={preset.icon} strokeWidth={1.5} />
      )}
      <span style={{
        fontSize: 15,
        fontFamily: FONTS.text,
        fontWeight: 600,
        color: '#e2e8f0',
        letterSpacing: 0.5,
        textAlign: 'center',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: width - 60,
      }}>
        {label}
      </span>
    </div>
  );
};
