/**
 * Core components for Nova Speech
 */

// Orchestration
export { SessionOrchestrator } from './orchestration';

// Processing
export {
  EventParser,
  TextAccumulator,
  UsageStatsCollector,
  AudioHandler,
  NovaSpeechResponseProcessor,
} from './processing';

export type {
  ParsedEvent,
  CompletionStartEvent,
  TextAccumulationResult,
  AudioBufferState,
  ProcessorContext,
  StreamResponseProcessor,
} from './processing';

// Streaming
export {
  EventQueue,
  SessionManager,
  StreamHandler,
} from './streaming';

export type {
  NovaSpeechSession,
  ResponseProcessor,
} from './streaming';
