/**
 * Audio subscriber for Nova Speech
 * Handles subscribing to Redis audio streams
 */

import { getPlatformDependencies } from "@gravityai-dev/plugin-base";
import { EventMetadata } from "../../events/metadata/EventMetadataProcessor";
import { AudioEventBuilder } from "../../events/incoming/builders/AudioEventBuilder";

const { createLogger, getRedisClient } = getPlatformDependencies();
const logger = createLogger("AudioSubscriber");

interface AudioSegmentData {
  action: string;
  chatId: string;
  nodeId: string;
  workflowId: string;
  audioData?: string;
  timestamp: number;
}

/**
 * Subscribes to audio events from Redis
 */
export class AudioSubscriber {
  private chatId: string;
  private nodeId: string;
  private workflowId: string;
  private eventQueue: any;
  private eventMetadata: EventMetadata;
  private promptName: string;
  private redisClient: any;
  private isRunning: boolean = false;
  // Removed segment control - always accept audio when subscriber is running
  private audioChunkIndex: number = 0;

  constructor(
    chatId: string,
    nodeId: string,
    workflowId: string,
    eventQueue: any,
    eventMetadata: EventMetadata,
    promptName: string
  ) {
    this.chatId = chatId;
    this.nodeId = nodeId;
    this.workflowId = workflowId;
    this.eventQueue = eventQueue;
    this.eventMetadata = eventMetadata;
    this.promptName = promptName;
  }

  /**
   * Start subscribing to audio events
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Audio subscriber already running", { chatId: this.chatId });
      return;
    }

    try {
      this.redisClient = await getRedisClient();
      this.isRunning = true;

      // Subscribe to audio channel - must match what server publishes to
      const REDIS_NAMESPACE = process.env.REDIS_NAMESPACE || process.env.NODE_ENV || "local";
      const channel = `${REDIS_NAMESPACE}:audio:input:channel`;
      await this.redisClient.subscribe(channel);

      logger.info("🎧 Audio subscriber started", {
        chatId: this.chatId,
        nodeId: `${this.nodeId}-${this.workflowId}`,
        channel,
      });

      // Handle incoming messages
      this.redisClient.on("message", this.handleMessage.bind(this));
    } catch (error) {
      logger.error("Failed to start audio subscriber", {
        error: error instanceof Error ? error.message : String(error),
        chatId: this.chatId,
      });
      throw error;
    }
  }

  /**
   * Handle incoming Redis messages
   */
  private async handleMessage(channel: string, message: string): Promise<void> {
    try {
      const data: AudioSegmentData = JSON.parse(message);

      // Filter by nodeId - client already sends composite nodeId
      if (data.nodeId !== `${this.nodeId}-${this.workflowId}`) {
        // Log for debugging
        logger.debug("Ignoring message for different nodeId", {
          expectedNodeId: `${this.nodeId}-${this.workflowId}`,
          receivedNodeId: data.nodeId,
          chatId: data.chatId
        });
        return;
      }

      // Filter by chatId
      if (data.chatId !== this.chatId) {
        return;
      }

      // Handle different action types
      switch (data.action) {
        case "SEND_AUDIO":
          if (data.audioData) {
            await this.handleAudioData(data.audioData);
          }
          break;
        default:
          logger.debug("Unknown audio action", { action: data.action });
      }
    } catch (error) {
      logger.error("Error handling audio message", {
        error: error instanceof Error ? error.message : String(error),
        chatId: this.chatId,
      });
    }
  }

  // Removed segment control methods - audio is always accepted when subscriber is running

  /**
   * Handle audio data - chunks large audio into smaller pieces
   */
  private async handleAudioData(audioData: string): Promise<void> {
    // Generate unique content name for this audio segment
    const contentName = `${this.chatId}_${Date.now()}`;
    
    logger.debug("Processing audio data", {
      chatId: this.chatId,
      audioDataLength: audioData.length,
    });

    // Create content start event using AudioEventBuilder
    const contentStartEvent = AudioEventBuilder.createContentStart(this.promptName, contentName);
    const contentStartWithMetadata = {
      ...contentStartEvent,
      _metadata: {
        ...this.eventMetadata,
        timestamp: new Date().toISOString(),
      },
    };
    this.eventQueue.enqueue(contentStartWithMetadata);

    // Create audio input events from the base64 audio
    // AudioEventBuilder will handle the chunking into 1KB pieces
    const audioEvents = AudioEventBuilder.createAudioInputEvents(this.promptName, contentName, audioData);
    
    logger.debug(`Created ${audioEvents.length} audio events`, {
      chatId: this.chatId,
      eventCount: audioEvents.length,
    });

    // Enqueue all audio events immediately - no delays!
    for (let i = 0; i < audioEvents.length; i++) {
      const audioEventWithMetadata = {
        ...audioEvents[i],
        _metadata: {
          ...this.eventMetadata,
          timestamp: new Date().toISOString(),
        },
      };
      this.eventQueue.enqueue(audioEventWithMetadata);
    }

    // Send content end event
    const contentEndEvent = AudioEventBuilder.createContentEnd(this.promptName, contentName);
    const contentEndWithMetadata = {
      ...contentEndEvent,
      _metadata: {
        ...this.eventMetadata,
        timestamp: new Date().toISOString(),
      },
    };
    this.eventQueue.enqueue(contentEndWithMetadata);

    this.audioChunkIndex++;
    logger.debug("Audio segment processed", {
      chatId: this.chatId,
      chunkIndex: this.audioChunkIndex,
      dataSize: audioData.length,
      eventCount: audioEvents.length,
    });
  }

  /**
   * Stop the subscriber
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      if (this.redisClient) {
        await this.redisClient.unsubscribe(`Audio-Stream`);
        await this.redisClient.quit();
      }
      this.isRunning = false;
      logger.info("🛑 Audio subscriber stopped", {
        chatId: this.chatId,
        totalChunks: this.audioChunkIndex,
      });
    } catch (error) {
      logger.error("Error stopping audio subscriber", {
        error: error instanceof Error ? error.message : String(error),
        chatId: this.chatId,
      });
    } finally {
      // Always reset state even if there were errors
      this.isRunning = false;
      this.redisClient = null;
    }
  }
}
