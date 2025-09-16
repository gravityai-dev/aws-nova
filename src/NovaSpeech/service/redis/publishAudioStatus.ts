/**
 * Audio status publishing service for Nova Speech
 * Based on publishState.ts pattern for consistency
 */

import { getPlatformDependencies } from "@gravityai-dev/plugin-base";
import { buildOutputEvent, OUTPUT_CHANNEL, createLogger } from "./publishAudioChunk";

const logger = createLogger("AudioStatusPublisher");

export interface AudioStatusConfig {
  state: "AUDIO_SESSION_STARTING" | "AUDIO_SESSION_READY" | "AUDIO_SESSION_ENDED" | "AUDIO_ERROR";
  message?: string;
  error?: string;
  redisChannel?: string; // Optional, defaults to AI_RESULT_CHANNEL
  chatId: string;
  conversationId: string;
  userId: string;
  providerId: string;
  workflowId: string;
  workflowRunId: string;
  metadata?: Record<string, any>;
}

/**
 * Publish an audio status update to Redis - fire and forget pattern
 */
export function publishAudioStatus(config: AudioStatusConfig): void {
  logger.info("Publishing audio status", {
    state: config.state,
    chatId: config.chatId,
    workflowId: config.workflowId,
  });

  // Fire and forget - don't await to avoid slowing down workflow
  _publishAudioStatusInternal(config).catch((error) => {
    logger.warn("Audio status publishing failed (non-blocking)", { error: error.message });
  });
}

/**
 * Internal async function to publish audio status
 */
async function _publishAudioStatusInternal(config: AudioStatusConfig): Promise<void> {
  const event = buildOutputEvent({
    eventType: "state",
    chatId: config.chatId,
    conversationId: config.conversationId,
    userId: config.userId,
    providerId: config.providerId,
    data: {
      state: config.state,
      message: config.message,
      error: config.error,
      workflowId: config.workflowId,
      workflowRunId: config.workflowRunId,
      ...config.metadata,
    },
  });

  // Use the universal gravityPublish function from platform API
  const platformDeps = getPlatformDependencies();
  await platformDeps.gravityPublish(OUTPUT_CHANNEL, event);

  logger.info("Audio status published successfully", {
    state: config.state,
    channel: OUTPUT_CHANNEL,
  });
}
