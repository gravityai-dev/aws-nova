/**
 * Audio publishing service for Nova Speech
 * Handles publishing audio output messages to Redis channels
 */

import { getAudioChunkPublisher, AI_RESULT_CHANNEL } from "@gravityai-dev/gravity-server";
import { createLogger, getConfig } from "../../../shared/platform";

const logger = createLogger("NovaAudio");

export interface AudioPublishConfig {
  audioData: string;      // Base64 encoded audio
  format: string;         // Audio format (mp3, wav, etc)
  textReference: string;  // Original text
  sourceType: string;     // "NovaSpeech"
  duration?: number;      // Duration in seconds
  index?: number;         // Chunk index for streaming
  redisChannel?: string;
  chatId: string;
  conversationId: string;
  userId: string;
  providerId: string;
  workflowId: string;
  workflowRunId: string;
  metadata?: Record<string, any>;
}

/**
 * Publish an audio chunk to Redis
 */
export async function publishAudio(config: AudioPublishConfig): Promise<{
  channel: string;
  success: boolean;
}> {
  logger.info("publishAudio called with AudioChunk", {
    conversationId: config.conversationId,
    workflowId: config.workflowId,
    sourceType: config.sourceType,
    format: config.format,
    index: config.index,
    hasAudioData: !!config.audioData,
    audioDataLength: config.audioData?.length || 0
  });
  
  try {
    // Create publisher - simple and direct
    const appConfig = getConfig();
    const providerId = "gravity-workflow-service";

    const publisher = getAudioChunkPublisher(
      appConfig.REDIS_HOST,
      appConfig.REDIS_PORT,
      appConfig.REDIS_PASSWORD,
      providerId,
      appConfig.REDIS_USERNAME // username from config
    );

    // Base message
    const baseMessage = {
      chatId: config.chatId,
      conversationId: config.conversationId,
      userId: config.userId,
      providerId: config.providerId,
    };

    // Publish audio chunk
    await publisher.publishAudioChunk(
      config.audioData,
      config.format,
      config.textReference,
      config.sourceType,
      config.duration,
      config.index,
      baseMessage,
      config.redisChannel ? { channel: config.redisChannel } : undefined
    );

    logger.info("Audio chunk published", {
      channel: config.redisChannel ?? AI_RESULT_CHANNEL,
      workflowId: config.workflowId,
      sourceType: config.sourceType,
    });

    return {
      channel: config.redisChannel ?? AI_RESULT_CHANNEL,
      success: true,
    };
  } catch (error: any) {
    logger.error("Failed to publish audio", {
      error: error.message,
      workflowId: config.workflowId,
    });
    throw error;
  }
}
