import type { MonitoringConfig } from './MonitoringRenderer';
import { COLORS } from '../../lib/theme';

/* ─── 1. ChaosEngineeringViz — normal → fault injection → recovery ───────── */

export const ChaosEngineeringViz: MonitoringConfig = {
  title: 'Chaos Engineering — Fault Injection',
  alertMessage: 'Fault injected: 40% packet loss on service-payments. Recovery in progress...',
  metrics: [
    {
      name: 'Success Rate (%)',
      values: [
        99.9, 99.8, 99.9, 99.7, 99.9,    // normal
        92.0, 78.0, 61.0, 55.0,            // fault injection
        60.0, 72.0, 85.0, 94.0, 98.5, 99.6, 99.8, // recovery
      ],
      threshold: 95,
      color: COLORS.teal,
      beatIndex: 0,
    },
    {
      name: 'Latency p99 (ms)',
      values: [
        45, 48, 42, 50, 47,               // normal
        120, 340, 580, 820,                // fault injection
        650, 420, 210, 110, 65, 50, 48,    // recovery
      ],
      threshold: 500,
      color: COLORS.saffron,
      beatIndex: 1,
    },
    {
      name: 'Error Count',
      values: [
        2, 1, 3, 1, 2,                    // normal
        45, 120, 280, 350,                 // fault injection
        220, 90, 30, 8, 3, 2, 1,           // recovery
      ],
      threshold: 100,
      color: COLORS.indigo,
      beatIndex: 2,
    },
  ],
};

/* ─── 2. LoggingTracingViz — waterfall span chart (simulated as metrics) ─── */

export const LoggingTracingViz: MonitoringConfig = {
  title: 'Distributed Tracing — Span Waterfall',
  alertMessage: 'Trace ID abc-123: db-query span exceeded 800ms SLA.',
  metrics: [
    {
      name: 'API Gateway (ms)',
      values: [12, 14, 11, 13, 15, 12, 14, 16, 13, 12, 18, 14],
      color: COLORS.teal,
      beatIndex: 0,
    },
    {
      name: 'Auth Service (ms)',
      values: [25, 28, 22, 30, 26, 24, 32, 27, 25, 29, 31, 26],
      color: COLORS.indigo,
      beatIndex: 1,
    },
    {
      name: 'DB Query (ms)',
      values: [80, 95, 120, 150, 200, 350, 580, 850, 620, 310, 140, 90],
      threshold: 800,
      color: COLORS.saffron,
      beatIndex: 2,
    },
    {
      name: 'Cache Hit Ratio (%)',
      values: [95, 94, 92, 88, 82, 70, 55, 40, 58, 75, 88, 94],
      threshold: 60,
      color: COLORS.gold,
      beatIndex: 3,
    },
  ],
};

/* ─── 3. MonitoringAlertViz — latency chart with threshold breach ────────── */

export const MonitoringAlertViz: MonitoringConfig = {
  title: 'Real-Time Monitoring Dashboard',
  alertMessage: 'P99 latency exceeded 200ms threshold. Auto-scaling triggered.',
  metrics: [
    {
      name: 'P50 Latency (ms)',
      values: [18, 20, 19, 22, 24, 28, 35, 42, 55, 48, 38, 25, 20, 19],
      color: COLORS.teal,
      beatIndex: 0,
    },
    {
      name: 'P99 Latency (ms)',
      values: [45, 52, 48, 65, 80, 120, 180, 250, 310, 220, 140, 75, 55, 48],
      threshold: 200,
      color: COLORS.saffron,
      beatIndex: 1,
    },
    {
      name: 'RPS (×100)',
      values: [12, 14, 15, 18, 25, 38, 52, 60, 58, 50, 35, 22, 15, 13],
      color: COLORS.indigo,
      beatIndex: 2,
    },
  ],
};

export const MONITORING_CONFIGS = {
  ChaosEngineeringViz,
  LoggingTracingViz,
  MonitoringAlertViz,
} as const;
