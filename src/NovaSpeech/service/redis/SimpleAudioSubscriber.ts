/**
 * Simple audio subscriber for Nova Speech
 * Direct pub/sub connection without session management
 */

import { createLogger } from "../redis/publishAudioChunk";
import {
  createAudioContentStart,
  createAudioInputEvents,
  createAudioContentEnd,
} from "../events/in/4_audioStreamingEvents";
import { EventMetadata } from "../events/eventHelpers";

const logger = createLogger("SimpleAudioSubscriber");

export interface AudioStreamMessage {
  chatId: string;
  nodeId: string; // nodeId-workflowId composite
  workflowId: string;
  audioInput: string; // Base64 encoded audio
  timestamp: number;
  action?: string; // Optional control action
}

export class SimpleAudioSubscriber {
  private subscriberClient: any = null;
  private audioChannel: string;
  private chatId: string;
  private nodeId: string;
  private workflowId: string;
  private eventQueue: any;
  private eventMetadata: EventMetadata;
  private promptName: string;
  private isAudioSegmentActive: boolean = false;

  constructor(
    chatId: string,
    nodeId: string,
    workflowId: string,
    eventQueue: any,
    eventMetadata: EventMetadata,
    promptName: string
  ) {
    const REDIS_NAMESPACE = process.env.REDIS_NAMESPACE || process.env.NODE_ENV || "local";
    this.audioChannel = `${REDIS_NAMESPACE}:audio:input:channel`;
    this.chatId = chatId;
    this.nodeId = nodeId;
    this.workflowId = workflowId;
    this.eventQueue = eventQueue;
    this.eventMetadata = eventMetadata;
    this.promptName = promptName;
  }

  /**
   * Start listening for audio
   */
  async start(): Promise<void> {
    try {
      const { getPlatformDependencies } = require("@gravityai-dev/plugin-base");
      const deps = getPlatformDependencies();
      const baseClient = deps.getRedisClient();

      if (!baseClient) {
        throw new Error("Redis client not available from platform");
      }

      // Duplicate for pub/sub
      this.subscriberClient = baseClient.duplicate();

      // Set up message handler
      this.subscriberClient.on("message", async (channel: string, message: string) => {
        if (channel === this.audioChannel) {
          await this.handleAudioMessage(message);
        }
      });

      // Subscribe to audio channel
      await this.subscriberClient.subscribe(this.audioChannel);

      logger.info("🎵 Started audio subscription", {
        channel: this.audioChannel,
        chatId: this.chatId,
        nodeId: `${this.nodeId}-${this.workflowId}`,
        timestamp: Date.now(),
        instanceId: Math.random().toString(36).substring(7),
      });
    } catch (error: any) {
      logger.error("Failed to start audio subscription", { error: error.message });
      throw error;
    }
  }

  /**
   * Stop listening for audio
   */
  async stop(): Promise<void> {
    if (!this.subscriberClient) {
      return;
    }

    logger.info("🛑 Stopping audio subscription", {
      chatId: this.chatId,
    });

    try {
      await this.subscriberClient.unsubscribe(this.audioChannel);
      this.subscriberClient.disconnect();
      this.subscriberClient = null;
    } catch (error: any) {
      logger.error("Failed to stop audio subscription", { error: error.message });
    }
  }

  /**
   * Handle incoming audio message
   */
  private async handleAudioMessage(message: string): Promise<void> {
    try {
      const audioMessage: AudioStreamMessage = JSON.parse(message);

      // Check if this message is for us
      const expectedNodeId = `${this.nodeId}-${this.workflowId}`;
      if (audioMessage.chatId !== this.chatId || audioMessage.nodeId !== expectedNodeId) {
        return; // Not for this instance
      }

      // Handle control actions
      if (audioMessage.action) {
        await this.handleControlAction(audioMessage.action);
        return; // Control messages don't contain audio
      }

      // Only process audio if we're in an active segment
      if (!this.isAudioSegmentActive) {
        logger.debug("Ignoring audio - no active segment", {
          chatId: this.chatId,
          timestamp: audioMessage.timestamp,
        });
        return;
      }

      // Process audio
      await this.feedAudioToNova(audioMessage);
    } catch (error: any) {
      logger.error("Failed to handle audio message", {
        error: error.message,
      });
    }
  }

  /**
   * Handle control actions (START_AUDIO_SEGMENT, END_AUDIO_SEGMENT)
   */
  private async handleControlAction(action: string): Promise<void> {
    logger.info("🎛️ Received control action", {
      action,
      chatId: this.chatId,
      previousState: this.isAudioSegmentActive,
    });

    switch (action) {
      case "START_AUDIO_SEGMENT":
        this.isAudioSegmentActive = true;
        logger.info("🎤 Audio segment started - accepting audio", {
          chatId: this.chatId,
        });
        break;

      case "END_AUDIO_SEGMENT":
        this.isAudioSegmentActive = false;
        logger.info("🔇 Audio segment ended - ignoring audio", {
          chatId: this.chatId,
        });
        break;

      default:
        logger.warn("Unknown control action", {
          action,
          chatId: this.chatId,
        });
    }
  }

  /**
   * Feed audio to Nova session
   */
  private async feedAudioToNova(audioMessage: AudioStreamMessage): Promise<void> {
    try {
      // With segment control, queue should never build up
      // Audio only arrives during active speech segments

      // Generate unique content name for this audio segment
      const contentName = `${audioMessage.chatId}_${audioMessage.timestamp}`;

      // Create Nova events for this audio chunk
      const contentStartEvent = createAudioContentStart(this.promptName, contentName);
      await this.eventQueue.enqueue(contentStartEvent, this.eventMetadata, this.promptName);

      // Create audio input events from the base64 audio
      console.log(
        `🎯 About to call createAudioInputEvents with: promptName=${this.promptName}, contentName=${contentName}, audioLength=${audioMessage.audioInput?.length}`
      );
      const audioEvents = createAudioInputEvents(this.promptName, contentName, audioMessage.audioInput);
      console.log(`📦 createAudioInputEvents returned ${audioEvents.length} events`);

      // Just pipe through - let Nova handle backpressure

      // Enqueue all audio events immediately - no delays!
      // The chunking already happened in createAudioInputEvents (8KB chunks)
      // Send all chunks immediately to Nova
      for (let i = 0; i < audioEvents.length; i++) {
        await this.eventQueue.enqueue(audioEvents[i], this.eventMetadata, this.promptName);
      }

      // Send content end
      const contentEndEvent = createAudioContentEnd(this.promptName, contentName);
      await this.eventQueue.enqueue(contentEndEvent, this.eventMetadata, this.promptName);
    } catch (error: any) {
      logger.error("Failed to feed audio to Nova", {
        chatId: audioMessage.chatId,
        error: error.message,
      });
    }
  }
}
