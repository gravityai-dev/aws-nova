import { EventMetadata } from "../events/eventHelpers";
import { createLogger } from "../redis/publishAudioChunk";

const logger = createLogger("StatusPublisher");

// Define the allowed audio status states
export type AudioStatusState = "AUDIO_SESSION_STARTING" | "AUDIO_SESSION_READY" | "AUDIO_SESSION_ENDED" | "AUDIO_ERROR";

export interface AudioStatusPayload {
  state: AudioStatusState;
  chatId: string;
  conversationId: string;
  userId: string;
  providerId: string;
  workflowId: string;
  workflowRunId: string;
}

export class StatusPublisher {
  /**
   * Publishes audio session ready status to Redis
   */
  static async publishAudioSessionReady(eventMetadata: EventMetadata): Promise<void> {
    try {
      const { publishAudioStatus } = await import("../redis/publishAudioStatus");

      await publishAudioStatus({
        state: "AUDIO_SESSION_READY",
        chatId: eventMetadata.chatId || "",
        conversationId: eventMetadata.conversationId || "",
        userId: eventMetadata.userId || "",
        providerId: "nova-service",
        workflowId: eventMetadata.sessionId || "",
        workflowRunId: eventMetadata.sessionId || "",
      });

      logger.info("📡 Published AUDIO_SESSION_READY status", {
        sessionId: eventMetadata.sessionId,
        chatId: eventMetadata.chatId,
      });
    } catch (error) {
      logger.error("Failed to publish audio session ready status", {
        error,
        sessionId: eventMetadata.sessionId,
        chatId: eventMetadata.chatId,
      });
      throw error;
    }
  }

  /**
   * Publishes audio session ended status to Redis
   */
  static async publishAudioSessionEnded(eventMetadata: EventMetadata): Promise<void> {
    try {
      const { publishAudioStatus } = await import("../redis/publishAudioStatus");

      await publishAudioStatus({
        state: "AUDIO_SESSION_ENDED",
        chatId: eventMetadata.chatId || "",
        conversationId: eventMetadata.conversationId || "",
        userId: eventMetadata.userId || "",
        providerId: "nova-service",
        workflowId: eventMetadata.sessionId || "",
        workflowRunId: eventMetadata.sessionId || "",
      });

      logger.info("📡 Published AUDIO_SESSION_ENDED status", {
        sessionId: eventMetadata.sessionId,
        chatId: eventMetadata.chatId,
      });
    } catch (error) {
      logger.error("Failed to publish audio session ended status", {
        error,
        sessionId: eventMetadata.sessionId,
        chatId: eventMetadata.chatId,
      });
      // Don't throw on cleanup errors
    }
  }

  /**
   * Publishes custom audio status to Redis
   */
  static async publishCustomAudioStatus(
    state: AudioStatusState,
    eventMetadata: EventMetadata,
    providerId: string = "nova-service"
  ): Promise<void> {
    try {
      const { publishAudioStatus } = await import("../redis/publishAudioStatus");

      await publishAudioStatus({
        state,
        chatId: eventMetadata.chatId || "",
        conversationId: eventMetadata.conversationId || "",
        userId: eventMetadata.userId || "",
        providerId,
        workflowId: eventMetadata.sessionId || "",
        workflowRunId: eventMetadata.sessionId || "",
      });

      logger.info(`📡 Published ${state} status`, {
        sessionId: eventMetadata.sessionId,
        chatId: eventMetadata.chatId,
        state,
      });
    } catch (error) {
      logger.error(`Failed to publish ${state} status`, {
        error,
        sessionId: eventMetadata.sessionId,
        chatId: eventMetadata.chatId,
        state,
      });
      throw error;
    }
  }

  /**
   * Publishes session status with error information
   */
  static async publishErrorStatus(eventMetadata: EventMetadata, error: any): Promise<void> {
    try {
      const { publishAudioStatus } = await import("../redis/publishAudioStatus");

      await publishAudioStatus({
        state: "AUDIO_ERROR",
        chatId: eventMetadata.chatId || "",
        conversationId: eventMetadata.conversationId || "",
        userId: eventMetadata.userId || "",
        providerId: "nova-service",
        workflowId: eventMetadata.sessionId || "",
        workflowRunId: eventMetadata.sessionId || "",
      });

      logger.error("📡 Published AUDIO_SESSION_ERROR status", {
        sessionId: eventMetadata.sessionId,
        chatId: eventMetadata.chatId,
        errorType: error.name,
        errorMessage: error.message,
      });
    } catch (publishError) {
      logger.error("Failed to publish error status", {
        originalError: error,
        publishError,
        sessionId: eventMetadata.sessionId,
        chatId: eventMetadata.chatId,
      });
      // Don't throw on error status publishing failures
    }
  }
}
