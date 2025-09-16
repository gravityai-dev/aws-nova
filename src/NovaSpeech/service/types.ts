/**
 * AWS Nova Speech Service Types
 */

export interface NovaSpeechMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface NovaSpeechInferenceConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface NovaSpeechRequest {
  messages: NovaSpeechMessage[];
  voice: string;
  inferenceConfig?: NovaSpeechInferenceConfig;
  streamResponse?: boolean;
}

export interface NovaSpeechResponse {
  audioData: string;  // Base64 encoded audio
  format: string;     // Audio format (e.g., "mp3")
  duration?: number;  // Duration in seconds
  textContent?: string; // Generated text content
}

export interface NovaSpeechStreamEvent {
  event: {
    contentStart?: {
      role: string;
      additionalModelFields?: string;
    };
    textOutput?: {
      content: string;
      role: string;
    };
    audioOutput?: {
      content: string; // Base64 audio chunk
    };
    completionEnd?: {
      type: string;
    };
  };
}

export const NOVA_SPEECH_VOICES = {
  TIFFANY: "tiffany",
  MATTHEW: "matthew", 
  AMY: "amy",
  AMBRE: "ambre",
  FLORIAN: "florian",
  BEATRICE: "beatrice",
  LORENZO: "lorenzo",
  GRETA: "greta",
  LENNART: "lennart",
  LUPE: "lupe",
  CARLOS: "carlos"
} as const;

export type NovaSpeechVoice = typeof NOVA_SPEECH_VOICES[keyof typeof NOVA_SPEECH_VOICES];

// Streaming types to match OpenAI pattern
export interface NovaSpeechStreamConfig {
  modelId: string;
  systemPrompt?: string;
  userPrompt?: string;
  audioInput?: string;
  voice?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  redisChannel?: string;
  interactive?: boolean;
}

export interface ConversationHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface NovaSpeechConfig extends NovaSpeechStreamConfig {
  // Additional config properties if needed
  conversationHistory?: ConversationHistoryItem[];
  toolResponse?: any[];
  controlSignal?: string; // Control signal for stream management (START, STOP, etc.)
}

export interface StreamingMetadata {
  workflowId: string;
  executionId: string;
  chatId: string;
  conversationId: string;
  userId: string;
  providerId?: string;
}

export interface StreamUsageStats {
  estimated: boolean;
  total_tokens?: number;
  chunk_count?: number;
  textOutput?: string;
  audioOutput?: string;
  sessionId?: string;
  transcription?: string;
  assistantResponse?: string;
  inputTokens?: number;
  outputTokens?: number;
}
