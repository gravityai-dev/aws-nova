/**
 * Redis Audio Stream Subscriber for Nova Speech
 * Subscribes to Audio-Stream channel and feeds audio chunks to Nova sessions
 */

import { createLogger, getConfig } from "./publishAudioChunk";
import {
  createAudioInputEvents,
  createAudioContentStart,
  createAudioContentEnd,
} from "../events/in/4_audioStreamingEvents";
import { EventMetadataProcessor } from "../events/EventMetadataProcessor";
import { EventMetadata } from "../events/eventHelpers";
import { delay } from "../stream/utils/timing";

const logger = createLogger("AudioStreamSubscriber");

export interface AudioStreamMessage {
  chatId: string;
  conversationId: string;
  userId: string;
  audioInput: string; // Base64 PCM data or special signals
  nodeId: string; // Format: "nodeId-workflowId"
  workflowId: string;
  timestamp: number;
  action?: string; // Optional action like "END_AUDIO_SEGMENT"
}

export interface ActiveSession {
  sessionId: string;
  eventQueue: any;
  eventMetadata: EventMetadata;
  promptName: string;
  nodeId: string;
  workflowId: string;
  audioContentStartSent?: boolean; // Track if contentStart was sent for current segment
  currentContentName?: string; // Track current audio segment's contentName
}

export class AudioStreamSubscriber {
  private activeSessions = new Map<string, ActiveSession>(); // chatId -> session
  private subscriberClient: any = null; // Redis client from platform
  private isSubscribed = false;
  private audioChannel: string;

  constructor() {
    // Use pub/sub for lower latency audio streaming
    const REDIS_NAMESPACE = process.env.REDIS_NAMESPACE || process.env.NODE_ENV || "local";
    this.audioChannel = `${REDIS_NAMESPACE}:audio:input:channel`;
  }

  /**
   * Register an active Nova session for audio streaming
   */
  registerSession(chatId: string, session: ActiveSession): void {
    logger.info("🔗 Registering Nova session for audio streaming", {
      chatId,
      sessionId: session.sessionId,
      nodeId: session.nodeId,
      workflowId: session.workflowId,
    });

    this.activeSessions.set(chatId, session);

    // Start subscription if this is the first session
    if (!this.isSubscribed) {
      this.startSubscription();
    }
  }

  /**
   * Unregister a Nova session
   */
  unregisterSession(chatId: string): void {
    logger.info("🔌 Unregistering Nova session", { chatId });
    this.activeSessions.delete(chatId);

    // Stop subscription if no active sessions
    if (this.activeSessions.size === 0 && this.isSubscribed) {
      this.stopSubscription();
    }
  }

  /**
   * Start Redis pub/sub subscription for audio chunks
   */
  private async startSubscription(): Promise<void> {
    if (this.isSubscribed) {
      return;
    }

    try {
      // Get Redis client from platform dependencies
      const { getPlatformDependencies } = require("@gravityai-dev/plugin-base");
      const deps = getPlatformDependencies();
      
      // Get a Redis client from the platform
      // Note: We need to create a duplicate client for pub/sub mode
      const baseClient = deps.getRedisClient();
      if (!baseClient) {
        throw new Error("Redis client not available from platform");
      }
      
      // Duplicate the client for pub/sub (Redis requires separate clients for pub/sub)
      this.subscriberClient = baseClient.duplicate();

      // Set up message handler
      this.subscriberClient.on('message', async (channel: string, message: string) => {
        if (channel === this.audioChannel) {
          await this.handleAudioMessage(message);
        }
      });

      // Subscribe to audio channel
      await this.subscriberClient.subscribe(this.audioChannel);
      this.isSubscribed = true;
      
      logger.info("🎵 Started Redis pub/sub subscription", {
        channel: this.audioChannel
      });
    } catch (error: any) {
      logger.error("Failed to start pub/sub subscription", { error: error.message });
      throw error;
    }
  }

  /**
   * Stop Redis pub/sub subscription
   */
  private async stopSubscription(): Promise<void> {
    if (!this.isSubscribed || !this.subscriberClient) {
      return;
    }

    logger.info("🛑 Stopping Redis pub/sub subscription");

    try {
      await this.subscriberClient.unsubscribe(this.audioChannel);
      this.subscriberClient.disconnect();
      this.subscriberClient = null;
      this.isSubscribed = false;
    } catch (error: any) {
      logger.error("Failed to stop pub/sub subscription", { error: error.message });
    }
  }

  /**
   * Handle incoming audio message from Redis
   */
  private async handleAudioMessage(message: string): Promise<void> {
    try {
      const audioMessage: AudioStreamMessage = JSON.parse(message);

      logger.info("📥 Received audio chunk from Redis", {
        chatId: audioMessage.chatId,
        nodeId: audioMessage.nodeId,
        workflowId: audioMessage.workflowId,
        audioLength: audioMessage.audioInput?.length || 0,
        timestamp: audioMessage.timestamp,
        action: audioMessage.action,
        audioInputPreview: audioMessage.audioInput?.substring(0, 30),
      });

      // Find matching active session
      const session = this.activeSessions.get(audioMessage.chatId);
      if (!session) {
        logger.warn("⚠️ No active session found for audio chunk", {
          chatId: audioMessage.chatId,
          availableSessions: Array.from(this.activeSessions.keys()),
        });
        return;
      }

      // Verify nodeId-workflowId matches this Nova instance
      const expectedNodeId = `${session.nodeId}-${session.workflowId}`;
      if (audioMessage.nodeId !== expectedNodeId) {
        logger.debug("🔀 Audio chunk not for this Nova instance", {
          chatId: audioMessage.chatId,
          expectedNodeId,
          receivedNodeId: audioMessage.nodeId,
          message: message.substring(0, 200), // Log first 200 chars for debugging
        });
        return;
      }

      // Convert audio chunk to Nova events and feed to session
      await this.feedAudioToSession(session, audioMessage);
    } catch (error: any) {
      logger.error("Failed to handle audio message", {
        error: error.message,
        message: message.substring(0, 200), // Log first 200 chars for debugging
      });
    }
  }

  /**
   * Feed audio chunk to Nova session
   */
  private async feedAudioToSession(session: ActiveSession, audioMessage: AudioStreamMessage): Promise<void> {
    try {
      logger.info("🎤 Processing complete audio segment", {
        sessionId: session.sessionId,
        chatId: audioMessage.chatId,
        audioLength: audioMessage.audioInput.length,
      });

      // Generate unique contentName for this audio segment
      const contentName = `${audioMessage.chatId}_${Date.now()}`;

      // 1. Send contentStart
      const contentStartEvent = createAudioContentStart(session.promptName, contentName);
      EventMetadataProcessor.processSingleEvent(contentStartEvent, session.eventMetadata, session.eventQueue);

      // 2. Send audio input events
      const audioEvents = createAudioInputEvents(session.promptName, contentName, audioMessage.audioInput);

      await EventMetadataProcessor.processEventBatchWithDelay(
        audioEvents,
        session.eventMetadata,
        session.eventQueue,
        5 // 5ms delay between events
      );

      // 3. Send contentEnd
      const contentEndEvent = createAudioContentEnd(session.promptName, contentName);
      EventMetadataProcessor.processSingleEvent(contentEndEvent, session.eventMetadata, session.eventQueue);

      logger.info("✅ Complete audio segment sent to Nova", {
        sessionId: session.sessionId,
        chatId: audioMessage.chatId,
        contentName: contentName,
        eventCount: audioEvents.length + 2, // +2 for contentStart and contentEnd
      });
    } catch (error: any) {
      logger.error("Failed to feed audio to session", {
        sessionId: session.sessionId,
        chatId: audioMessage.chatId,
        error: error.message,
      });
    }
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): Map<string, ActiveSession> {
    return this.activeSessions;
  }

  /**
   * Get subscription status
   */
  getStatus(): { isSubscribed: boolean; activeSessions: number } {
    return {
      isSubscribed: this.isSubscribed,
      activeSessions: this.activeSessions.size,
    };
  }
}

// Singleton instance
export const audioStreamSubscriber = new AudioStreamSubscriber();
