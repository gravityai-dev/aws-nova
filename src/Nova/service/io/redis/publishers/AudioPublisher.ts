/**
 * Audio publishing utilities for Nova Speech
 */

import { AudioState, StreamingMetadata, AudioChunk } from "../../../api/types";
import { getPlatformDependencies } from "@gravityai-dev/plugin-base";
import { v4 as uuid } from "uuid";

const { createLogger, gravityPublish } = getPlatformDependencies();
const logger = createLogger("AudioPublisher");

const OUTPUT_CHANNEL = "gravity:output";

/**
 * Configuration for audio publishing
 */
interface AudioPublishConfig {
  audioData: string;
  format: string;
  sourceType: string;
  index: number;
  sessionId: string;
  metadata: StreamingMetadata;
  audioState: AudioState;
  additionalMetadata?: Record<string, any>;
}

/**
 * Configuration for state-only publishing
 */
interface StatePublishConfig {
  state: AudioState;
  sessionId: string;
  metadata: StreamingMetadata;
  message?: string;
  additionalMetadata?: Record<string, any>;
}

/**
 * Handles publishing of audio chunks and audio state events
 */
export class AudioPublisher {
  /**
   * Publishes an audio chunk with data
   */
  static async publishAudio(config: AudioPublishConfig): Promise<void> {
    const event = this.buildAudioEvent({
      audioData: config.audioData,
      format: config.format,
      sourceType: config.sourceType,
      index: config.index,
      sessionId: config.sessionId,
      metadata: config.metadata,
      audioState: config.audioState,
      additionalMetadata: config.additionalMetadata,
    });

    try {
      await gravityPublish(OUTPUT_CHANNEL, event);
    } catch (error) {
      logger.error("Failed to publish audio chunk", {
        error: error instanceof Error ? error.message : String(error),
        sessionId: config.sessionId,
      });
      throw error;
    }
  }

  /**
   * Publishes an audio state event (no audio data)
   */
  static async publishState(config: StatePublishConfig): Promise<void> {
    const event = this.buildAudioEvent({
      audioData: "",
      format: "lpcm",
      sourceType: "NovaSpeech",
      index: 0,
      sessionId: config.sessionId,
      metadata: config.metadata,
      audioState: config.state,
      additionalMetadata: {
        message: config.message,
        ...config.additionalMetadata,
      },
    });

    try {
      // Fire and forget for state events
      gravityPublish(OUTPUT_CHANNEL, event).catch((error) => {
        logger.error("Failed to publish audio state", {
          error: error instanceof Error ? error.message : String(error),
          state: config.state,
          sessionId: config.sessionId,
        });
      });

      logger.info("Audio state published", {
        state: config.state,
        sessionId: config.sessionId,
        message: config.message,
      });
    } catch (error) {
      logger.error("Failed to publish audio state", {
        error: error instanceof Error ? error.message : String(error),
        state: config.state,
        sessionId: config.sessionId,
      });
    }
  }

  /**
   * Convenience method for publishing session ready state
   */
  static async publishSessionReady(
    sessionId: string,
    metadata: StreamingMetadata,
    nodeId: string,
    queueInfo?: { queueSize: number; maxQueueSize: number }
  ): Promise<void> {
    await this.publishState({
      state: "AUDIO_SESSION_READY",
      sessionId,
      metadata,
      message: "Audio session is ready to receive input",
      additionalMetadata: {
        nodeId,
        ...queueInfo,
      },
    });
  }

  /**
   * Convenience method for publishing Nova speech started
   */
  static async publishNovaSpeechStarted(sessionId: string, metadata: StreamingMetadata): Promise<void> {
    await this.publishState({
      state: "NOVA_SPEECH_STARTED",
      sessionId,
      metadata,
      message: "Nova has started speaking - microphone should be muted",
    });
  }

  /**
   * Convenience method for publishing Nova speech ended
   */
  static async publishNovaSpeechEnded(sessionId: string, metadata: StreamingMetadata): Promise<void> {
    await this.publishState({
      state: "NOVA_SPEECH_ENDED",
      sessionId,
      metadata,
      message: "Nova has finished speaking - microphone can be unmuted",
    });
  }

  /**
   * Builds the audio event structure
   */
  private static buildAudioEvent(config: AudioPublishConfig): any {
    return {
      id: uuid(),
      timestamp: new Date().toISOString(),
      providerId: config.metadata.providerId || "nova-speech",
      chatId: config.metadata.chatId,
      conversationId: config.metadata.conversationId,
      userId: config.metadata.userId,
      __typename: "GravityEvent",
      type: "GRAVITY_EVENT",
      eventType: "audioChunk",
      data: {
        audioData: config.audioData,
        format: config.format,
        sourceType: config.sourceType,
        index: config.index,
        sessionId: config.sessionId,
        metadata: {
          audioState: config.audioState,
          workflowId: config.metadata.workflowId,
          workflowRunId: config.metadata.executionId,
          timestamp: new Date().toISOString(),
          ...config.additionalMetadata,
        },
      },
    };
  }
}
