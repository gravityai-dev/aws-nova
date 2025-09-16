/**
 * AWS Nova Speech Node Types
 */

export interface AWSNovaSpeechConfig {
  model?: string;
  voice?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  streamResponse?: boolean;
  audioInput?: string;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  toolResponse?: any[];
  control?: string;
  redisChannel?: string;
  topP?: number;
}

export interface AWSNovaSpeechInput {
  input?: {
    message?: string;
  };
  prompt?: string;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export interface AWSNovaSpeechOutput {
  audioData?: string;
  textContent?: string;
  format?: string;
  duration?: number;
  usage?: {
    totalTokens?: number;
  };
  __outputs?: any;
}
