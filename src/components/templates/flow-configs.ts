import type { FlowConfig } from './FlowRenderer';

// ── 1. Request Flow ─────────────────────────────────────────────────

export const RequestFlowConfig: FlowConfig = {
  title: 'Request Flow',
  packetColor: '#20C997',
  stages: [
    { id: 'client', label: 'Client', iconSlug: 'googlechrome', color: '#60A5FA', beatIndex: 0, description: 'Browser / App' },
    { id: 'cdn', label: 'CDN', iconSlug: 'cloudflare', color: '#F6821F', beatIndex: 1, description: 'Cache static assets' },
    { id: 'lb', label: 'Load Balancer', iconSlug: 'nginx', color: '#009639', beatIndex: 2, description: 'Distribute traffic' },
    { id: 'api', label: 'API Gateway', iconSlug: 'fastapi', color: '#009688', beatIndex: 3, description: 'Auth + Rate limit' },
    { id: 'service', label: 'Service', iconSlug: 'nodedotjs', color: '#339933', beatIndex: 4, description: 'Business logic' },
    { id: 'db', label: 'Database', iconSlug: 'postgresql', color: '#4169E1', beatIndex: 5, description: 'Persist data' },
  ],
};

// ── 2. Auth Flow ────────────────────────────────────────────────────

export const AuthFlowConfig: FlowConfig = {
  title: 'Authentication Flow',
  packetColor: '#818CF8',
  stages: [
    { id: 'user', label: 'User', iconSlug: undefined, color: '#60A5FA', beatIndex: 0, description: 'Enter credentials' },
    { id: 'auth-server', label: 'Auth Server', iconSlug: 'auth0', color: '#EB5424', beatIndex: 1, description: 'Validate identity' },
    { id: 'token-gen', label: 'Token Gen', iconSlug: 'jsonwebtokens', color: '#D63AFF', beatIndex: 2, description: 'Issue JWT / OAuth' },
    { id: 'resource', label: 'Resource API', iconSlug: 'nodedotjs', color: '#339933', beatIndex: 3, description: 'Verify & serve' },
    { id: 'refresh', label: 'Refresh', iconSlug: undefined, color: '#F59E0B', beatIndex: 4, description: 'Rotate tokens' },
  ],
};

// ── 3. Data Pipeline ────────────────────────────────────────────────

export const DataPipelineConfig: FlowConfig = {
  title: 'Data Pipeline',
  packetColor: '#22C55E',
  stages: [
    { id: 'source', label: 'Source', iconSlug: 'postgresql', color: '#4169E1', beatIndex: 0, description: 'Raw events' },
    { id: 'ingest', label: 'Ingest', iconSlug: 'apachekafka', color: '#231F20', beatIndex: 1, description: 'Stream / batch' },
    { id: 'transform', label: 'Transform', iconSlug: 'apachespark', color: '#E25A1C', beatIndex: 2, description: 'Clean & enrich' },
    { id: 'store', label: 'Store', iconSlug: 'amazons3', color: '#569A31', beatIndex: 3, description: 'Data lake / warehouse' },
    { id: 'serve', label: 'Serve', iconSlug: 'grafana', color: '#F46800', beatIndex: 4, description: 'Dashboards & APIs' },
  ],
};

// ── 4. CI/CD Flow ───────────────────────────────────────────────────

export const CIFlowConfig: FlowConfig = {
  title: 'CI/CD Pipeline',
  packetColor: '#F59E0B',
  stages: [
    { id: 'commit', label: 'Commit', iconSlug: 'git', color: '#F05032', beatIndex: 0, description: 'Push code' },
    { id: 'build', label: 'Build', iconSlug: 'github', color: '#FFFFFF', beatIndex: 1, description: 'Compile & bundle' },
    { id: 'test', label: 'Test', iconSlug: 'jest', color: '#C21325', beatIndex: 2, description: 'Unit + integration' },
    { id: 'scan', label: 'Security Scan', iconSlug: 'snyk', color: '#4C4A73', beatIndex: 3, description: 'Vulnerability check' },
    { id: 'deploy', label: 'Deploy', iconSlug: 'docker', color: '#2496ED', beatIndex: 4, description: 'Ship to prod' },
    { id: 'monitor', label: 'Monitor', iconSlug: 'datadog', color: '#632CA6', beatIndex: 5, description: 'Observe health' },
  ],
};

// ── 5. Network Flow ─────────────────────────────────────────────────

export const NetworkFlowConfig: FlowConfig = {
  title: 'Network Request Flow',
  packetColor: '#38BDF8',
  stages: [
    { id: 'dns', label: 'DNS Lookup', iconSlug: undefined, color: '#60A5FA', beatIndex: 0, description: 'Resolve domain' },
    { id: 'tcp', label: 'TCP Handshake', iconSlug: undefined, color: '#34D399', beatIndex: 1, description: 'SYN → SYN-ACK → ACK' },
    { id: 'tls', label: 'TLS Negotiation', iconSlug: undefined, color: '#FBBF24', beatIndex: 2, description: 'Certificate exchange' },
    { id: 'http', label: 'HTTP Request', iconSlug: undefined, color: '#A78BFA', beatIndex: 3, description: 'Send payload' },
    { id: 'response', label: 'Response', iconSlug: undefined, color: '#20C997', beatIndex: 4, description: 'Receive data' },
  ],
};

// ── 6. Concurrency Control Viz ──────────────────────────────────────

export const ConcurrencyControlVizConfig: FlowConfig = {
  title: 'Concurrency Control',
  packetColor: '#EF4444',
  stages: [
    { id: 'request', label: 'Request', iconSlug: undefined, color: '#60A5FA', beatIndex: 0, description: 'Acquire lock' },
    { id: 'lock', label: 'Lock Manager', iconSlug: undefined, color: '#F59E0B', beatIndex: 1, description: 'Optimistic / Pessimistic' },
    { id: 'validate', label: 'Validate', iconSlug: undefined, color: '#A78BFA', beatIndex: 2, description: 'Check conflicts' },
    { id: 'execute', label: 'Execute', iconSlug: undefined, color: '#20C997', beatIndex: 3, description: 'Apply mutation' },
    { id: 'release', label: 'Release', iconSlug: undefined, color: '#EF4444', beatIndex: 4, description: 'Free lock' },
  ],
};

// ── 7. Saga Pattern Viz ─────────────────────────────────────────────

export const SagaPatternVizConfig: FlowConfig = {
  title: 'Saga Pattern',
  packetColor: '#818CF8',
  stages: [
    { id: 'order', label: 'Create Order', iconSlug: undefined, color: '#60A5FA', beatIndex: 0, description: 'Step 1' },
    { id: 'payment', label: 'Payment', iconSlug: 'stripe', color: '#635BFF', beatIndex: 1, description: 'Step 2: Charge' },
    { id: 'inventory', label: 'Inventory', iconSlug: undefined, color: '#F59E0B', beatIndex: 2, description: 'Step 3: Reserve' },
    { id: 'shipping', label: 'Shipping', iconSlug: undefined, color: '#20C997', beatIndex: 3, description: 'Step 4: Dispatch' },
    { id: 'confirm', label: 'Confirm', iconSlug: undefined, color: '#22C55E', beatIndex: 4, description: 'Saga complete' },
  ],
};

// ── 8. Circuit Breaker Viz ──────────────────────────────────────────

export const CircuitBreakerVizConfig: FlowConfig = {
  title: 'Circuit Breaker',
  packetColor: '#EF4444',
  stages: [
    { id: 'caller', label: 'Caller', iconSlug: undefined, color: '#60A5FA', beatIndex: 0, description: 'Outgoing request' },
    { id: 'breaker', label: 'Circuit Breaker', iconSlug: undefined, color: '#F59E0B', beatIndex: 1, description: 'Closed / Open / Half' },
    { id: 'service', label: 'Service', iconSlug: undefined, color: '#20C997', beatIndex: 2, description: 'Downstream call' },
    { id: 'fallback', label: 'Fallback', iconSlug: undefined, color: '#EF4444', beatIndex: 3, description: 'Graceful degrade' },
    { id: 'recover', label: 'Recovery', iconSlug: undefined, color: '#22C55E', beatIndex: 4, description: 'Half-open probe' },
  ],
};

// ── 9. Blue-Green / Canary Viz ──────────────────────────────────────

export const BlueGreenCanaryVizConfig: FlowConfig = {
  title: 'Blue-Green & Canary Deploy',
  packetColor: '#38BDF8',
  stages: [
    { id: 'router', label: 'Router', iconSlug: 'nginx', color: '#009639', beatIndex: 0, description: 'Traffic split' },
    { id: 'blue', label: 'Blue (Stable)', iconSlug: undefined, color: '#3B82F6', beatIndex: 1, description: '90% traffic' },
    { id: 'green', label: 'Green (New)', iconSlug: undefined, color: '#22C55E', beatIndex: 2, description: '10% canary' },
    { id: 'monitor', label: 'Monitor', iconSlug: 'datadog', color: '#632CA6', beatIndex: 3, description: 'Error rate / latency' },
    { id: 'promote', label: 'Promote', iconSlug: undefined, color: '#F59E0B', beatIndex: 4, description: 'Swap or rollback' },
  ],
};

// ── 10. Feature Flag Viz ────────────────────────────────────────────

export const FeatureFlagVizConfig: FlowConfig = {
  title: 'Feature Flag System',
  packetColor: '#A78BFA',
  stages: [
    { id: 'config', label: 'Flag Config', iconSlug: undefined, color: '#818CF8', beatIndex: 0, description: 'Define rules' },
    { id: 'evaluate', label: 'Evaluate', iconSlug: undefined, color: '#F59E0B', beatIndex: 1, description: 'User context check' },
    { id: 'variant', label: 'Variant', iconSlug: undefined, color: '#20C997', beatIndex: 2, description: 'A / B selection' },
    { id: 'render', label: 'Render', iconSlug: undefined, color: '#60A5FA', beatIndex: 3, description: 'Show feature' },
    { id: 'metrics', label: 'Metrics', iconSlug: 'grafana', color: '#F46800', beatIndex: 4, description: 'Track impact' },
  ],
};

// ── 11. GraphQL Viz ─────────────────────────────────────────────────

export const GraphQLVizConfig: FlowConfig = {
  title: 'GraphQL Request Flow',
  packetColor: '#E10098',
  stages: [
    { id: 'client', label: 'Client Query', iconSlug: 'graphql', color: '#E10098', beatIndex: 0, description: 'Typed query' },
    { id: 'validate', label: 'Validate', iconSlug: undefined, color: '#F59E0B', beatIndex: 1, description: 'Schema check' },
    { id: 'resolve', label: 'Resolvers', iconSlug: undefined, color: '#818CF8', beatIndex: 2, description: 'Fetch data' },
    { id: 'dataloader', label: 'DataLoader', iconSlug: undefined, color: '#20C997', beatIndex: 3, description: 'Batch & cache' },
    { id: 'response', label: 'JSON Response', iconSlug: undefined, color: '#60A5FA', beatIndex: 4, description: 'Exact shape' },
  ],
};

// ── 12. gRPC Viz ────────────────────────────────────────────────────

export const GRPCVizConfig: FlowConfig = {
  title: 'gRPC Communication',
  packetColor: '#00BCD4',
  stages: [
    { id: 'proto', label: 'Proto Definition', iconSlug: undefined, color: '#A78BFA', beatIndex: 0, description: '.proto schema' },
    { id: 'codegen', label: 'Code Gen', iconSlug: undefined, color: '#F59E0B', beatIndex: 1, description: 'Stubs & types' },
    { id: 'client', label: 'Client Stub', iconSlug: undefined, color: '#60A5FA', beatIndex: 2, description: 'Serialize (Protobuf)' },
    { id: 'http2', label: 'HTTP/2', iconSlug: undefined, color: '#20C997', beatIndex: 3, description: 'Multiplexed stream' },
    { id: 'server', label: 'Server Handler', iconSlug: undefined, color: '#EF4444', beatIndex: 4, description: 'Deserialize & respond' },
  ],
};

// ── Lookup map ──────────────────────────────────────────────────────

export const FLOW_CONFIGS: Record<string, FlowConfig> = {
  RequestFlow: RequestFlowConfig,
  AuthFlow: AuthFlowConfig,
  DataPipeline: DataPipelineConfig,
  CIFlow: CIFlowConfig,
  NetworkFlow: NetworkFlowConfig,
  ConcurrencyControlViz: ConcurrencyControlVizConfig,
  SagaPatternViz: SagaPatternVizConfig,
  CircuitBreakerViz: CircuitBreakerVizConfig,
  BlueGreenCanaryViz: BlueGreenCanaryVizConfig,
  FeatureFlagViz: FeatureFlagVizConfig,
  GraphQLViz: GraphQLVizConfig,
  GRPCViz: GRPCVizConfig,
};
