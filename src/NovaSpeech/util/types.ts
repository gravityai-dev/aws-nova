/**
 * AWS Nova Speech Node Types
 */

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

export interface AWSNovaSpeechConfig {
  systemPrompt: string;
  toolResponse?: any[];
  audioInput?: string;
  conversationHistory?: any;
  voice: string;
  temperature: number;
  maxTokens?: number;
  topP?: number;
  redisChannel: string;
}

export interface AWSNovaSpeechInput {
  [key: string]: any;
}

export interface AWSNovaSpeechOutput {
  __outputs: {
    streamId: string;
    text: string;
    conversation: {
      user: string;
      assistant: string;
    };
  };
}

export interface NovaSpeechStreamConfig {
  systemPrompt: string;
  audioInput?: string;
  voice: string;
  temperature: number;
  redisChannel: string;
}

export interface AWSNovaSpeechServiceInput {
  systemPrompt: string;
  text: string;
  voice: string;
  temperature: number;
  redisChannel: string;
}

export interface AWSNovaSpeechServiceOutput {
  success: boolean;
  channel: string;
  audioFormat: string;
  textContent?: string;
}
