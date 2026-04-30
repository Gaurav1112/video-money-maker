export { TemplateFactory } from './TemplateFactory';
export type {
  TemplateFactoryProps,
  RendererProps,
  ConceptBox,
  ConceptArrow,
  GeneratedConceptConfig,
} from './TemplateFactory';

// Renderers -- built by parallel agents, re-exported as they become available.
// Each export is wrapped in a try-catch to avoid breaking the build if a
// renderer hasn't been created yet.

/* eslint-disable @typescript-eslint/no-empty-function */
try { module.exports = { ...module.exports, ...require('./ArchitectureRenderer') }; } catch {}
try { module.exports = { ...module.exports, ...require('./FlowRenderer') }; } catch {}
try { module.exports = { ...module.exports, ...require('./ConceptRenderer') }; } catch {}
try { module.exports = { ...module.exports, ...require('./ComparisonRenderer') }; } catch {}
try { module.exports = { ...module.exports, ...require('./MonitoringRenderer') }; } catch {}
/* eslint-enable @typescript-eslint/no-empty-function */
