import { describe, it, expect, vi, afterEach } from 'vitest';
import { getConceptDiagram, buildDiagramFilters } from '../../src/stock/concept-diagram.js';
import type { ConceptDiagram } from '../../src/stock/concept-diagram.js';

describe('getConceptDiagram', () => {
  it('returns kafka consumer-groups template for kafka-consumer-groups slug', () => {
    const d = getConceptDiagram('kafka-consumer-groups');
    expect(d.title).toBe('KAFKA CONSUMER GROUPS');
    expect(d.nodes.find(n => n.id === 'prod')).toBeDefined();
    expect(d.nodes.find(n => n.id === 'c4')?.sublabel).toBe('IDLE');
  });
  it('returns kafka partitioning for kafka-partitioning slug', () => {
    const d = getConceptDiagram('kafka-partitioning');
    expect(d.title).toBe('KAFKA PARTITIONING');
  });
  it('falls back to load-balancing template', () => {
    const d = getConceptDiagram('load-balancing');
    expect(d.title).toBe('LOAD BALANCING');
    expect(d.nodes.find(n => n.id === 's3')?.sublabel).toBe('DOWN');
  });
  it('falls back to redis cache template', () => {
    expect(getConceptDiagram('redis-caching').title).toBe('CACHE-ASIDE PATTERN');
  });
  it('falls back to oauth template for jwt slug', () => {
    expect(getConceptDiagram('jwt-vs-session').title).toBe('OAUTH 2.0 FLOW');
  });
  it('falls back to generic 3-point for unknown slug', () => {
    const d = getConceptDiagram('quantum-fft', 'Quantum FFT');
    expect(d.nodes).toHaveLength(3);
    expect(d.title).toBe('QUANTUM FFT');
  });
  it('truncates long titles to 22 chars in generic fallback', () => {
    const d = getConceptDiagram('this-is-a-very-very-long-topic-name', 'this is a very very long topic name');
    expect(d.title.length).toBeLessThanOrEqual(22);
  });
});

describe('buildDiagramFilters', () => {
  const opts = { fontArg: '', fontArgFor: (_: string) => '' };
  it('emits a non-empty filter list for kafka diagram', () => {
    const filters = buildDiagramFilters(getConceptDiagram('kafka-consumer-groups'), 6.84, opts);
    expect(filters.length).toBeGreaterThan(20);
  });
  it('emits enable=gte gates on every primitive', () => {
    const filters = buildDiagramFilters(getConceptDiagram('kafka-consumer-groups'), 6.84, opts);
    for (const f of filters) {
      expect(f).toMatch(/enable='gte\(t,\d+\.\d+\)'/);
    }
  });
  it('paces stages between t=1.9 and t=sceneDur-0.3', () => {
    const filters = buildDiagramFilters(getConceptDiagram('kafka-consumer-groups'), 6.84, opts);
    const reveals = filters
      .map(f => f.match(/gte\(t,(\d+\.\d+)\)/)?.[1])
      .filter((x): x is string => !!x)
      .map(parseFloat);
    expect(Math.min(...reveals)).toBeCloseTo(1.9, 2);
    expect(Math.max(...reveals)).toBeLessThanOrEqual(6.54 + 0.01);
  });
  it('is byte-deterministic — same inputs produce same filter strings', () => {
    const a = buildDiagramFilters(getConceptDiagram('kafka-consumer-groups'), 6.84, opts);
    const b = buildDiagramFilters(getConceptDiagram('kafka-consumer-groups'), 6.84, opts);
    expect(a).toEqual(b);
  });
  it('escapes single quotes and colons in labels', () => {
    const d = getConceptDiagram('kafka-consumer-groups');
    d.nodes[0].label = "Don't: do'this";
    const filters = buildDiagramFilters(d, 6.84, opts);
    const has = filters.some(f => f.includes("Don\\'t\\: do\\'this"));
    expect(has).toBe(true);
  });
  it('handles short scenes (< 2.5s) without crashing', () => {
    const filters = buildDiagramFilters(getConceptDiagram('load-balancing'), 2.0, opts);
    expect(filters.length).toBeGreaterThan(0);
  });

  // Panel-22 Carmack P2: OOB node guard — console.warn is emitted for nodes
  // whose bounding box exceeds [DIAGRAM_TOP=200, DIAGRAM_BOTTOM=1060].
  describe('OOB node guard (Panel-22 Carmack P2)', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('warns and skips a node with y+h exceeding DIAGRAM_BOTTOM', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const diagram: ConceptDiagram = {
        title: 'OOB TEST',
        nodes: [
          // In-bounds node — should produce filters normally.
          { id: 'ok', x: 100, y: 300, w: 200, h: 80, borderColor: '2196F3', label: 'OK', stage: 1 },
          // OOB node: y=990, h=80 → y+h=1070 > DIAGRAM_BOTTOM(1060).
          { id: 'oob', x: 100, y: 990, w: 200, h: 80, borderColor: 'F44336', label: 'OOB', stage: 2 },
        ],
        edges: [],
      };
      buildDiagramFilters(diagram, 6.0, opts);
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0]![0]).toMatch(/\[concept-diagram\] node "oob" clipped/);
    });

    it('does not warn for an in-bounds diagram', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      buildDiagramFilters(getConceptDiagram('kafka-consumer-groups'), 6.84, opts);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
