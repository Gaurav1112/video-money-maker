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

describe('buildDiagramFilters — titleOnly mode (Panel-22 MrBeast P1)', () => {
  const opts = { fontArg: '', fontArgFor: (_: string) => '' };

  it('emits exactly 3 filters (border box, accent bar, title text)', () => {
    const d = getConceptDiagram('kafka-consumer-groups');
    const filters = buildDiagramFilters(d, 3.0, { ...opts, titleOnly: true, startT: 0 });
    expect(filters).toHaveLength(3);
  });

  it('first filter is a drawbox with yellow border', () => {
    const d = getConceptDiagram('kafka-consumer-groups');
    const [box] = buildDiagramFilters(d, 3.0, { ...opts, titleOnly: true, startT: 0 });
    expect(box).toContain('drawbox');
    expect(box).toContain('FFEB3B');
  });

  it('last filter is a drawtext with concept title', () => {
    const d = getConceptDiagram('kafka-consumer-groups');
    const filters = buildDiagramFilters(d, 3.0, { ...opts, titleOnly: true, startT: 0 });
    const last = filters[filters.length - 1];
    expect(last).toContain('drawtext');
    expect(last).toContain('KAFKA CONSUMER GROUPS');
  });

  it('enable expression is persistent from startT=0 (gte(t,0.000))', () => {
    const d = getConceptDiagram('kafka-consumer-groups');
    const filters = buildDiagramFilters(d, 3.0, { ...opts, titleOnly: true, startT: 0 });
    for (const f of filters) {
      expect(f).toContain("enable='gte(t,0.000)'");
    }
  });

  it('does NOT emit node or edge filters', () => {
    const d = getConceptDiagram('kafka-consumer-groups');
    const filters = buildDiagramFilters(d, 3.0, { ...opts, titleOnly: true, startT: 0 });
    // Nodes emit labels like 'Producer', 'P0', 'C1'; edges emit arrowheads.
    const hasNodeContent = filters.some(f => f.includes('Producer') || f.includes("text='P0'"));
    expect(hasNodeContent).toBe(false);
  });

  it('is byte-deterministic in titleOnly mode', () => {
    const d = getConceptDiagram('kafka-consumer-groups');
    const a = buildDiagramFilters(d, 3.0, { ...opts, titleOnly: true, startT: 0 });
    const b = buildDiagramFilters(d, 3.0, { ...opts, titleOnly: true, startT: 0 });
    expect(a).toEqual(b);
  });

  it('respects hideAfter in enable expression when provided', () => {
    const d = getConceptDiagram('kafka-consumer-groups');
    const filters = buildDiagramFilters(d, 3.0, { ...opts, titleOnly: true, startT: 0, hideAfter: 2.5 });
    for (const f of filters) {
      expect(f).toContain("enable='gte(t,0.000)*lt(t,2.500)'");
    }
  });
});

describe('buildDiagramFilters — tombstoneText co-render (Panel-22 Beggs P1)', () => {
  const opts = { fontArg: '', fontArgFor: (_: string) => '' };

  it('emits tombstone drawtext when tombstoneText + hideAfter are set', () => {
    const d = getConceptDiagram('kafka-consumer-groups');
    const filters = buildDiagramFilters(d, 6.84, {
      ...opts, startT: 0.05, instant: true, hideAfter: 3.84,
      tombstoneText: 'Consumer groups = parallel processing',
    });
    const tombFilter = filters.find(f => f.includes('Consumer groups'));
    expect(tombFilter).toBeDefined();
    expect(tombFilter).toContain('drawtext');
  });

  it('tombstone enable expression matches [hideAfter-2.5, hideAfter] window', () => {
    const d = getConceptDiagram('kafka-consumer-groups');
    const filters = buildDiagramFilters(d, 6.84, {
      ...opts, startT: 0.05, instant: true, hideAfter: 3.84,
      tombstoneText: 'Consumer groups = parallel processing',
    });
    const tombFilter = filters.find(f => f.includes('Consumer groups'));
    // tombStart = max(0, 3.84 - 2.5) = 1.34 → enable='gte(t,1.340)*lt(t,3.840)'
    expect(tombFilter).toContain("enable='gte(t,1.340)*lt(t,3.840)'");
  });

  it('tombstone is NOT emitted without hideAfter', () => {
    const d = getConceptDiagram('kafka-consumer-groups');
    const filters = buildDiagramFilters(d, 6.84, {
      ...opts, startT: 0.05, instant: true,
      tombstoneText: 'Consumer groups = parallel processing',
    });
    const tombFilter = filters.find(f => f.includes('Consumer groups'));
    expect(tombFilter).toBeUndefined();
  });

  it('tombstoneText backdrop appears in diagram filter chain (drawbox)', () => {
    const d = getConceptDiagram('kafka-consumer-groups');
    const filters = buildDiagramFilters(d, 6.84, {
      ...opts, startT: 0.05, instant: true, hideAfter: 3.84,
      tombstoneText: 'Consumer groups = parallel processing',
    });
    const backdropFilter = filters.find(
      f => f.includes('drawbox') && f.includes('y=490') && f.includes('black@0.70'),
    );
    expect(backdropFilter).toBeDefined();
  });

  it('tombstoneText is byte-deterministic', () => {
    const d = getConceptDiagram('kafka-consumer-groups');
    const makeFilters = () => buildDiagramFilters(d, 6.84, {
      ...opts, startT: 0.05, instant: true, hideAfter: 3.84,
      tombstoneText: 'Consumer groups = parallel processing',
    });
    expect(makeFilters()).toEqual(makeFilters());
  });

  it('clamps tombStart to 0 when hideAfter < 2.5', () => {
    const d = getConceptDiagram('kafka-consumer-groups');
    const filters = buildDiagramFilters(d, 3.5, {
      ...opts, startT: 0.05, instant: true, hideAfter: 2.0,
      tombstoneText: 'short scene tombstone',
    });
    const tombFilter = filters.find(f => f.includes('short scene tombstone'));
    // tombStart = max(0, 2.0 - 2.5) = 0 → enable='gte(t,0.000)*lt(t,2.000)'
    expect(tombFilter).toContain("enable='gte(t,0.000)*lt(t,2.000)'");
  });
});
