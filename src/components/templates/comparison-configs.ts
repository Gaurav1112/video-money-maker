import type { ComparisonConfig } from './ComparisonRenderer';
import { COLORS } from '../../lib/theme';

/* ─── 1. VSBattle — generic template, rows filled from scene content ─────── */

export const VSBattle: ComparisonConfig = {
  optionAName: 'Option A',
  optionBName: 'Option B',
  optionAColor: COLORS.teal,
  optionBColor: COLORS.saffron,
  title: 'Head-to-Head Comparison',
  rows: [
    // Placeholder rows — overridden at render time with scene content
    { attribute: 'Performance', optionA: '—', optionB: '—', winner: 'tie', beatIndex: 0 },
    { attribute: 'Scalability', optionA: '—', optionB: '—', winner: 'tie', beatIndex: 1 },
    { attribute: 'Ease of Use', optionA: '—', optionB: '—', winner: 'tie', beatIndex: 2 },
    { attribute: 'Cost',        optionA: '—', optionB: '—', winner: 'tie', beatIndex: 3 },
  ],
};

/* ─── 2. ScaleComparison — Horizontal vs Vertical Scaling ────────────────── */

export const ScaleComparison: ComparisonConfig = {
  optionAName: 'Horizontal Scaling',
  optionBName: 'Vertical Scaling',
  optionAColor: COLORS.teal,
  optionBColor: COLORS.indigo,
  title: 'Scaling Strategies',
  rows: [
    { attribute: 'Approach',       optionA: 'Add more machines',       optionB: 'Upgrade existing machine',  winner: 'tie',  beatIndex: 0 },
    { attribute: 'Cost Curve',     optionA: 'Linear (commodity HW)',   optionB: 'Exponential (high-end HW)', winner: 'A',    beatIndex: 1 },
    { attribute: 'Fault Tolerance',optionA: 'Built-in redundancy',     optionB: 'Single point of failure',   winner: 'A',    beatIndex: 2 },
    { attribute: 'Complexity',     optionA: 'Distributed state mgmt',  optionB: 'Simple — single process',   winner: 'B',    beatIndex: 3 },
    { attribute: 'Data Consistency',optionA: 'Eventual / partitioned', optionB: 'Strong (single node)',      winner: 'B',    beatIndex: 4 },
    { attribute: 'Max Capacity',   optionA: 'Virtually unlimited',     optionB: 'Hardware ceiling',          winner: 'A',    beatIndex: 5 },
  ],
};

/* ─── 3. BeforeAfter — Optimized vs Unoptimized ─────────────────────────── */

export const BeforeAfter: ComparisonConfig = {
  optionAName: 'Unoptimized',
  optionBName: 'Optimized',
  optionAColor: COLORS.red,
  optionBColor: COLORS.teal,
  title: 'Before vs After Optimization',
  rows: [
    { attribute: 'Latency (p99)',   optionA: '2400 ms',       optionB: '85 ms',          winner: 'B', beatIndex: 0 },
    { attribute: 'Throughput',      optionA: '120 req/s',     optionB: '8,500 req/s',    winner: 'B', beatIndex: 1 },
    { attribute: 'Memory Usage',    optionA: '4.2 GB',        optionB: '680 MB',         winner: 'B', beatIndex: 2 },
    { attribute: 'Error Rate',      optionA: '3.2%',          optionB: '0.01%',          winner: 'B', beatIndex: 3 },
    { attribute: 'Cold Start',      optionA: '12 sec',        optionB: '0.8 sec',        winner: 'B', beatIndex: 4 },
  ],
};

/* ─── 4. APIVersioningViz — URL vs Header vs Query Param ─────────────────── */

export const APIVersioningViz: ComparisonConfig = {
  optionAName: 'URL Path',
  optionBName: 'Header / Query',
  optionAColor: COLORS.saffron,
  optionBColor: COLORS.indigo,
  title: 'API Versioning Strategies',
  rows: [
    { attribute: 'Example',         optionA: '/api/v2/users',          optionB: 'Accept: application/vnd.api.v2+json', winner: 'tie', beatIndex: 0 },
    { attribute: 'Discoverability', optionA: 'Visible in URL',         optionB: 'Hidden in headers',                   winner: 'A',   beatIndex: 1 },
    { attribute: 'Cache Friendly',  optionA: 'Each version = new URL', optionB: 'Same URL, vary header',               winner: 'A',   beatIndex: 2 },
    { attribute: 'Clean URLs',      optionA: 'Version pollutes path',  optionB: 'Resource-centric URLs',               winner: 'B',   beatIndex: 3 },
    { attribute: 'Client Effort',   optionA: 'Change URL string',      optionB: 'Set header per request',              winner: 'A',   beatIndex: 4 },
    { attribute: 'Industry Usage',  optionA: 'GitHub, Stripe, Twilio', optionB: 'Microsoft, GitHub (also)',             winner: 'tie', beatIndex: 5 },
  ],
};

/* ─── 5. DataSerializationViz — JSON vs Protobuf vs Avro ────────────────── */

export const DataSerializationViz: ComparisonConfig = {
  optionAName: 'JSON',
  optionBName: 'Protobuf / Avro',
  optionAColor: COLORS.gold,
  optionBColor: COLORS.teal,
  title: 'Data Serialization Formats',
  rows: [
    { attribute: 'Readability',      optionA: 'Human-readable text',     optionB: 'Binary — needs tooling',   winner: 'A',   beatIndex: 0 },
    { attribute: 'Payload Size',     optionA: '~1 KB for 10 fields',     optionB: '~200 B for 10 fields',     winner: 'B',   beatIndex: 1 },
    { attribute: 'Parse Speed',      optionA: '~50 \u00B5s',             optionB: '~5 \u00B5s',               winner: 'B',   beatIndex: 2 },
    { attribute: 'Schema Evolution', optionA: 'No enforced schema',      optionB: 'Backward/forward compat',  winner: 'B',   beatIndex: 3 },
    { attribute: 'Browser Support',  optionA: 'Native JSON.parse()',     optionB: 'Requires JS library',      winner: 'A',   beatIndex: 4 },
    { attribute: 'Debugging',        optionA: 'Paste in any editor',     optionB: 'Need protoc / avro-tools', winner: 'A',   beatIndex: 5 },
    { attribute: 'Best For',         optionA: 'REST APIs, config files', optionB: 'gRPC, Kafka, big data',    winner: 'tie', beatIndex: 6 },
  ],
};

export const COMPARISON_CONFIGS = {
  VSBattle,
  ScaleComparison,
  BeforeAfter,
  APIVersioningViz,
  DataSerializationViz,
} as const;
