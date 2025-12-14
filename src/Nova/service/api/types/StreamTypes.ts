/**
 * Streaming-related types for Nova Speech Service
 */

/**
 * Audio state types for tracking audio session status
 */
export type AudioState =
  // Session states (generic)
  | "SESSION_STARTING"
  | "SESSION_READY"
  | "SESSION_ENDED"
  | "SESSION_ERROR"
  // Assistant speech states (generic - works with any provider)
  | "SPEECH_STARTED"
  | "SPEECH_STREAMING"
  | "SPEECH_ENDED"
  // User speech states
  | "USER_SPEECH_STARTED"
  | "USER_SPEECH_STREAMING"
  | "USER_SPEECH_ENDED"
  // Tool use states
  | "TOOL_USE"
  // Special states
  | "AUDIO_SIGNAL"
  | "SILENCE";

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
  status: "active" | "paused" | "ended" | "error";
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
