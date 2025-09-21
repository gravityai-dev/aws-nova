/**
 * Public API types for Nova Speech Service
 */

export * from './ConfigTypes';
export * from './StreamTypes';

// Re-export commonly used types
export type {
  NovaSpeechConfig,
  NovaSpeechResult,
  AudioFormat,
  VoiceOption,
} from './ConfigTypes';

export type {
  StreamingSession,
  StreamingMetadata,
  StreamUsageStats,
  AudioChunk,
  AudioState,
} from './StreamTypes';
