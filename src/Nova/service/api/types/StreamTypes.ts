/**
 * Streaming-related types for Nova Speech Service
 */

/**
 * Audio state types for tracking audio session status
 */
export type AudioState = 
  // Session states
  | 'AUDIO_SESSION_STARTING'
  | 'AUDIO_SESSION_READY'
  | 'AUDIO_SESSION_ENDED'
  | 'AUDIO_ERROR'
  // Nova speech states
  | 'NOVA_SPEECH_STARTED'
  | 'NOVA_SPEECH_STREAMING'
  | 'NOVA_SPEECH_ENDED'
  // User speech states
  | 'USER_SPEECH_STARTED'
  | 'USER_SPEECH_STREAMING'
  | 'USER_SPEECH_ENDED'
  // Special states
  | 'AUDIO_SIGNAL'
  | 'SILENCE';

/**
 * Metadata for streaming sessions
 */
export interface StreamingMetadata {
  chatId: string;
  conversationId: string;
  userId: string;
  workflowId?: string;
  executionId?: string;
  providerId?: string;
  nodeId?: string;
}

/**
 * Audio chunk for streaming
 */
export interface AudioChunk {
  audioData: string;
  format: string;
  sourceType: string;
  index: number;
  sessionId?: string;
  metadata?: {
    audioState: AudioState;
    timestamp?: string;
    [key: string]: any;
  };
}

/**
 * Streaming session information
 */
export interface StreamingSession {
  sessionId: string;
  status: 'active' | 'paused' | 'ended' | 'error';
  startTime: Date;
  endTime?: Date;
  metadata: StreamingMetadata;
  queueSize?: number;
  maxQueueSize?: number;
}

/**
 * Usage statistics for streaming
 */
export interface StreamUsageStats {
  estimated: boolean;
  total_tokens: number;
  inputTokens: number;
  outputTokens: number;
  chunk_count: number;
  textOutput: string;
  audioOutput?: string;
  transcription: string;
  assistantResponse: string;
}

/**
 * Event metadata for correlation
 */
export interface EventMetadata {
  chatId?: string;
  conversationId?: string;
  userId?: string;
  sessionId: string;
  promptName: string;
  timestamp?: string;
}
