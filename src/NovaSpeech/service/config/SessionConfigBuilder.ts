import { NovaSpeechConfig } from "../types";
import { EventMetadata } from "../events/eventHelpers";

export interface InferenceConfig {
  maxTokens: number;
  temperature: number;
  topP: number;
}

export class SessionConfigBuilder {
  /**
   * Builds inference configuration from Nova Speech config
   */
  static buildInferenceConfig(config: NovaSpeechConfig): InferenceConfig {
    return {
      maxTokens: 4096,
      temperature: config.temperature || 0.7,
      topP: config.topP || 0.9,
    };
  }

  /**
   * Builds event metadata for session tracking
   */
  static buildEventMetadata(
    metadata: any, 
    sessionId: string, 
    promptName: string
  ): EventMetadata {
    return {
      chatId: metadata.chatId,
      conversationId: metadata.conversationId,
      userId: metadata.userId,
      sessionId,
      promptName,
    };
  }

  /**
   * Generates prompt name from metadata
   */
  static generatePromptName(metadata: any, sessionId: string): string {
    return metadata.chatId || `prompt-${sessionId}`;
  }

  /**
   * Validates Nova Speech configuration
   */
  static validateConfig(config: NovaSpeechConfig): void {
    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 1)) {
      throw new Error("Temperature must be between 0 and 1");
    }

    if (config.topP !== undefined && (config.topP < 0 || config.topP > 1)) {
      throw new Error("TopP must be between 0 and 1");
    }

    if (config.voice && !this.isValidVoice(config.voice)) {
      throw new Error(`Invalid voice: ${config.voice}. Valid voices: ${this.getValidVoices().join(", ")}`);
    }
  }

  /**
   * Gets list of valid Nova Speech voices
   */
  static getValidVoices(): string[] {
    return [
      "tiffany", "matthew", "amy", "ambre", "florian", 
      "beatrice", "lorenzo", "greta", "lennart", "lupe", "carlos"
    ];
  }

  /**
   * Validates if a voice is supported
   */
  static isValidVoice(voice: string): boolean {
    return this.getValidVoices().includes(voice.toLowerCase());
  }

  /**
   * Gets default voice
   */
  static getDefaultVoice(): string {
    return "tiffany";
  }

  /**
   * Builds session logging context
   */
  static buildLoggingContext(
    sessionId: string,
    metadata: any,
    config: NovaSpeechConfig
  ): Record<string, any> {
    return {
      sessionId,
      chatId: metadata.chatId,
      conversationId: metadata.conversationId,
      userId: metadata.userId,
      voice: config.voice || this.getDefaultVoice(),
      hasAudioInput: !!config.audioInput,
      hasSystemPrompt: !!config.systemPrompt,
      hasConversationHistory: !!(config.conversationHistory?.length),
      controlSignal: config.controlSignal,
    };
  }
}
