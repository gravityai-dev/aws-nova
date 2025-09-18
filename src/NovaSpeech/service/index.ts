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
import { NovaSessionManager } from "./NovaSessionManager";

export class NovaSpeechService {
  private readonly logger = createLogger("NovaSpeechService");

  /**
   * Generate speech from text using Nova Sonic with Redis streaming
   * Uses SessionOrchestrator for cleaner session lifecycle management
   */
  async generateSpeechStream(config: NovaSpeechConfig, metadata: any, context: any): Promise<NovaSpeechStats> {
    try {
      // Validate configuration
      SessionConfigBuilder.validateConfig(config);

      // Extract required identifiers
      const workflowId = metadata.workflowId || context.workflowId || "unknown-workflow";
      const nodeId = context.nodeId || "unknown-node";
      const chatId = metadata.chatId || "unknown-chat";

      // Log session context
      const loggingContext = SessionConfigBuilder.buildLoggingContext("pending", metadata, config);
      this.logger.info("🚀 Nova Speech request via Session Manager", {
        ...loggingContext,
        workflowId,
        nodeId,
        chatId
      });

      // Use session manager to get or create session
      return await NovaSessionManager.getOrCreateSession(
        workflowId,
        nodeId, 
        chatId,
        config, 
        metadata, 
        context
      );
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

      const workflowId = metadata.workflowId || context.workflowId || "unknown-workflow";
      const nodeId = context.nodeId || "unknown-node";
      const chatId = metadata.chatId || "unknown-chat";

      this.logger.error("Failed to generate speech", {
        error: error.message,
        errorName: error.name,
        errorCode: error.code,
        statusCode: error.$metadata?.httpStatusCode,
        requestId: error.$metadata?.requestId,
        workflowId,
        nodeId,
        chatId,
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
