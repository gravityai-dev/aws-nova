/**
 * AWS Nova Speech Service
 * Handles text-to-speech generation using AWS Nova Sonic model
 */

import type { Logger } from "pino";
import { NovaSpeechConfig, StreamUsageStats as NovaSpeechStats } from "./types";
import { SessionOrchestrator } from "./orchestration/SessionOrchestrator";
import { SessionConfigBuilder } from "./config/SessionConfigBuilder";
import { createLogger } from "./redis/publishAudioChunk";
import { AwsErrorHandler } from "./errors/AwsErrorHandler";

export class NovaSpeechService {
  private readonly orchestrator = new SessionOrchestrator();
  private readonly logger = createLogger("NovaSpeechService");

  /**
   * Generate speech from text using Nova Sonic with Redis streaming
   * Uses SessionOrchestrator for cleaner session lifecycle management
   */
  async generateSpeechStream(config: NovaSpeechConfig, metadata: any, context: any): Promise<NovaSpeechStats> {
    try {
      // Validate configuration
      SessionConfigBuilder.validateConfig(config);

      // Log session context
      const loggingContext = SessionConfigBuilder.buildLoggingContext("pending", metadata, config);
      this.logger.info("🚀 Starting Nova Speech session", loggingContext);

      // Delegate to orchestrator
      return await this.orchestrator.orchestrateSession(config, metadata, context);
    } catch (error: any) {
      // Handle timeout errors gracefully
      if (AwsErrorHandler.isTimeoutError(error)) {
        this.logger.info("⏱️ Nova timeout - returning empty results", { 
          workflowId: metadata.workflowId,
          chatId: metadata.chatId 
        });
        
        // Return empty results to prevent platform disruption
        return {
          estimated: false,
          total_tokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          chunk_count: 0,
          audioOutput: "",
          textOutput: "",
          transcription: "",
          assistantResponse: ""
        };
      }

      this.logger.error("Failed to generate speech", {
        error: error.message,
        errorName: error.name,
        errorCode: error.code,
        statusCode: error.$metadata?.httpStatusCode,
        requestId: error.$metadata?.requestId,
        config: {
          hasSystemPrompt: !!config.systemPrompt,
          hasAudioInput: !!config.audioInput,
          redisChannel: config.redisChannel,
          voice: config.voice,
        },
        metadata,
      });
      throw error;
    }
  }
}
