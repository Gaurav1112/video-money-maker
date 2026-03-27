import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const OUTPUT_DIR = process.env.OUTPUT_DIR || './output';

export function renderMermaidToSvg(mermaidCode: string): string {
  const hash = crypto.createHash('md5').update(mermaidCode).digest('hex').slice(0, 8);
  const svgDir = path.join(OUTPUT_DIR, 'diagrams');
  fs.mkdirSync(svgDir, { recursive: true });

  const inputPath = path.join(svgDir, `${hash}.mmd`);
  const outputPath = path.join(svgDir, `${hash}.svg`);

  // Return cached if exists
  if (fs.existsSync(outputPath)) {
    return fs.readFileSync(outputPath, 'utf-8');
  }

  fs.writeFileSync(inputPath, mermaidCode);

  try {
    execFileSync('npx', ['mmdc', '-i', inputPath, '-o', outputPath, '-t', 'dark', '-b', 'transparent'], {
      timeout: 30000,
    });
    const svg = fs.readFileSync(outputPath, 'utf-8');
    fs.unlinkSync(inputPath); // cleanup
    return svg;
  } catch (error) {
    console.warn('Mermaid rendering failed:', (error as Error).message);
    // Return a placeholder SVG
    return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400">
      <rect width="800" height="400" fill="#1A1625" rx="12"/>
      <text x="400" y="200" text-anchor="middle" fill="#A9ACB3" font-size="24" font-family="Inter">
        [Diagram: ${mermaidCode.split('\n')[0].slice(0, 40)}]
      </text>
    </svg>`;
  }
}
