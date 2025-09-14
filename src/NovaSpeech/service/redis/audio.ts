/**
 * Audio publishing service for Nova Speech
 * Handles publishing audio output messages to Redis channels
 */

import { getAudioChunkPublisher, AI_RESULT_CHANNEL } from "@gravityai-dev/gravity-server";
import { createLogger, getConfig, publishAudioChunk } from "../../../shared/platform";

const logger = createLogger("NovaAudio");

export interface AudioPublishConfig {
  audioData: string; // Base64 encoded audio
  format: string; // Audio format (mp3, wav, etc)
  textReference: string; // Original text
  sourceType: string; // "NovaSpeech"
  duration?: number; // Duration in seconds
  index?: number; // Chunk index for streaming
  redisChannel?: string;
  chatId: string;
  conversationId: string;
  userId: string;
  providerId: string;
  workflowId: string;
  workflowRunId: string;
  sessionId?: string; // Nova Speech session ID
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
    audioDataLength: config.audioData?.length || 0,
  });

  try {
    // Create publisher - simple and direct
    const appConfig = getConfig();
    const providerId = "gravity-workflow-service";

    // Use the new unified audio chunk publisher

    // Base message
    const baseMessage = {
      chatId: config.chatId,
      conversationId: config.conversationId,
      userId: config.userId,
      providerId: config.providerId,
    };

    // Publish audio chunk
    await publishAudioChunk({
      audioData: config.audioData,
      format: config.format,
      sourceType: config.sourceType,
      index: config.index || 0,
      chatId: config.chatId,
      conversationId: config.conversationId,
      userId: config.userId,
      providerId: config.providerId,
      sessionId: config.sessionId || undefined,
      metadata: {
        textReference: config.textReference,
        duration: config.duration,
        workflowId: config.workflowId,
        workflowRunId: config.workflowRunId,
      },
    });

    logger.info("Audio chunk published as GravityEvent", {
      eventType: "audioChunk",
      workflowId: config.workflowId,
      sourceType: config.sourceType,
      format: config.format,
      index: config.index,
    });

    return {
      channel: "gravity:output",
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
