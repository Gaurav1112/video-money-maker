import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface D2Node {
  id: string;
  label: string;
  shape?: 'rectangle' | 'cylinder' | 'oval' | 'hexagon' | 'diamond';
  color?: string;     // fill color
  stroke?: string;    // border color
}

export interface D2Edge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
  color?: string;
}

/**
 * Convert nodes + edges to D2 syntax, render to SVG via d2 CLI.
 * Returns the SVG string for embedding in Remotion.
 * Deterministic: same input = same output (content-hashed cache).
 *
 * IMPORTANT: This uses execSync and must only be called during storyboard
 * generation (Node.js), NOT during Remotion browser rendering.
 */
export function renderD2Diagram(
  nodes: D2Node[],
  edges: D2Edge[],
  options: { direction?: 'right' | 'down'; theme?: number; pad?: number } = {},
): string {
  const { direction = 'right', theme = 200, pad = 40 } = options;

  // Build D2 source
  let d2 = `direction: ${direction}\n\n`;

  for (const n of nodes) {
    const fill = n.color || '#1e1b4b';
    const stroke = n.stroke || '#818cf8';
    d2 += `${n.id}: "${n.label}" {\n`;
    if (n.shape === 'cylinder') d2 += `  shape: cylinder\n`;
    else if (n.shape === 'diamond') d2 += `  shape: diamond\n`;
    else if (n.shape === 'oval') d2 += `  shape: oval\n`;
    else if (n.shape === 'hexagon') d2 += `  shape: hexagon\n`;
    d2 += `  style.fill: "${fill}"\n`;
    d2 += `  style.stroke: "${stroke}"\n`;
    d2 += `  style.font-color: "#e2e8f0"\n`;
    d2 += `  style.border-radius: 12\n`;
    d2 += `}\n\n`;
  }

  for (const e of edges) {
    d2 += `${e.from} -> ${e.to}`;
    if (e.label) d2 += `: "${e.label}"`;
    d2 += ` {\n`;
    if (e.color) d2 += `  style.stroke: "${e.color}"\n`;
    if (e.dashed) d2 += `  style.stroke-dash: 5\n`;
    d2 += `}\n`;
  }

  // Write to temp file, render, read SVG
  const tmpDir = path.join(process.cwd(), 'output', '.d2-cache');
  fs.mkdirSync(tmpDir, { recursive: true });

  // Use content hash for caching
  const hash = crypto.createHash('md5').update(d2).digest('hex').slice(0, 12);
  const d2Path = path.join(tmpDir, `${hash}.d2`);
  const svgPath = path.join(tmpDir, `${hash}.svg`);

  // Return cached SVG if exists
  if (fs.existsSync(svgPath)) {
    return fs.readFileSync(svgPath, 'utf-8');
  }

  fs.writeFileSync(d2Path, d2);

  try {
    execSync(
      `d2 "${d2Path}" "${svgPath}" --theme ${theme} --dark-theme ${theme} -l dagre --pad ${pad}`,
      { timeout: 10000 },
    );
    return fs.readFileSync(svgPath, 'utf-8');
  } catch (err) {
    console.warn('D2 render failed:', err);
    return ''; // fallback: empty SVG, let Remotion render nothing
  }
}
