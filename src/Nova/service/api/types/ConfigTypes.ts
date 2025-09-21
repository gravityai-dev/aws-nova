/**
 * Configuration types for Nova Speech Service
 */

/**
 * Available voice options for Nova Speech
 */
export type VoiceOption = 
  | 'tiffany' 
  | 'matthew' 
  | 'amy' 
  | 'ambre' 
  | 'florian' 
  | 'beatrice' 
  | 'lorenzo' 
  | 'greta' 
  | 'lennart' 
  | 'lupe' 
  | 'carlos';

/**
 * Audio format options
 */
export type AudioFormat = 'lpcm' | 'mp3' | 'opus';

/**
 * Control signals for session management
 */
export type ControlSignal = 'START_CALL' | 'END_CALL' | 'PAUSE' | 'RESUME';

/**
 * Main configuration for Nova Speech
 */
export interface NovaSpeechConfig {
  // Basic configuration
  systemPrompt?: string;
  voice?: VoiceOption;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  
  // Audio configuration
  audioInput?: string;
  audioFormat?: AudioFormat;
  
  // Control
  controlSignal?: ControlSignal;
  
  // Tool configuration
  tools?: any[];
  toolResponse?: any[];
  mcpService?: Record<string, (input: any) => Promise<any>>;
  
  // Conversation context
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  
  // Redis configuration
  redisChannel?: string;
}

/**
 * Result from Nova Speech execution
 */
export interface NovaSpeechResult {
  // Usage statistics
  estimated: boolean;
  total_tokens: number;
  inputTokens: number;
  outputTokens: number;
  chunk_count: number;
  
  // Output content
  textOutput: string;
  audioOutput?: string;
  transcription: string;
  assistantResponse: string;
  
  // Session metadata
  sessionId?: string;
  duration?: number;
}
