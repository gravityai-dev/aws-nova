/**
 * WebSocket-based audio publisher for low-latency streaming
 */

import { AudioPublisherInterface, AudioPublishConfig, StatePublishConfig } from "./AudioPublisherInterface";
import { getPlatformDependencies } from "@gravityai-dev/plugin-base";

const { createLogger, getAudioWebSocketManager } = getPlatformDependencies();
const logger = createLogger("WebSocketAudioPublisher");

// Chunk configuration
const TARGET_CHUNK_SIZE = 32768; // 32KB target chunk size for better streaming
const MAX_BUFFER_DELAY = 50; // 50ms max delay before flushing

interface ChunkBuffer {
  conversationId: string;
  chunks: Buffer[];
  totalSize: number;
  metadata?: any;
  audioState?: string;
  timer?: NodeJS.Timeout;
}

export class WebSocketAudioPublisher implements AudioPublisherInterface {
  private chunkBuffers: Map<string, ChunkBuffer> = new Map();
  /**
   * Publish audio via WebSocket
   */
  async publishAudio(config: AudioPublishConfig): Promise<void> {
    const audioWSManager = getAudioWebSocketManager?.();

    if (!audioWSManager) {
      logger.warn("WebSocket manager not available - audio will not be published", {
        conversationId: config.conversationId,
      });
      return; // Silently return for now during testing
    }

    try {
      // Handle state-only messages immediately
      if (config.audioState === "SPEECH_STARTED" || config.audioState === "SPEECH_ENDED") {
        audioWSManager.sendControl(config.conversationId, {
          type: "audioState",
          state: config.audioState,
          metadata: config.metadata,
        });

        // If this is an end state, flush any buffered chunks
        if (config.audioState === "SPEECH_ENDED") {
          await this.flushBuffer(config.conversationId);
        }
        return;
      }

      // Convert base64 to buffer for binary transmission
      const audioBuffer = Buffer.from(config.audioData, "base64");

      // Add to chunk buffer
      this.addToBuffer(config.conversationId, audioBuffer, config.metadata, config.audioState);
    } catch (error: any) {
      logger.error("Failed to publish audio via WebSocket", {
        error: error.message,
        conversationId: config.conversationId,
        audioState: config.audioState,
      });
      throw error;
    }
  }

  /**
   * Add audio chunk to buffer and flush if needed
   */
  private addToBuffer(conversationId: string, chunk: Buffer, metadata?: any, audioState?: string): void {
    let buffer = this.chunkBuffers.get(conversationId);

    if (!buffer) {
      buffer = {
        conversationId,
        chunks: [],
        totalSize: 0,
        metadata,
        audioState,
      };
      this.chunkBuffers.set(conversationId, buffer);
    }

    // Add chunk to buffer
    buffer.chunks.push(chunk);
    buffer.totalSize += chunk.length;

    // Update metadata if provided
    if (metadata) buffer.metadata = metadata;
    if (audioState) buffer.audioState = audioState;

    // Clear existing timer
    if (buffer.timer) {
      clearTimeout(buffer.timer);
    }

    // Check if we should flush
    if (buffer.totalSize >= TARGET_CHUNK_SIZE) {
      // Flush immediately if we've reached target size
      this.flushBuffer(conversationId);
    } else {
      // Set a timer to flush after delay
      buffer.timer = setTimeout(() => {
        this.flushBuffer(conversationId);
      }, MAX_BUFFER_DELAY);
    }
  }

  /**
   * Flush buffered chunks for a session
   */
  private async flushBuffer(conversationId: string): Promise<void> {
    const buffer = this.chunkBuffers.get(conversationId);
    if (!buffer || buffer.chunks.length === 0) {
      return;
    }

    const audioWSManager = getAudioWebSocketManager?.();
    if (!audioWSManager) {
      return;
    }

    try {
      // Combine all chunks into a single buffer
      const combinedBuffer = Buffer.concat(buffer.chunks);

      logger.debug("Flushing audio buffer", {
        conversationId,
        originalChunks: buffer.chunks.length,
        totalSize: combinedBuffer.length,
        targetSize: TARGET_CHUNK_SIZE,
      });

      // Send the combined buffer
      const success = audioWSManager.sendAudio(conversationId, combinedBuffer);

      if (!success) {
        logger.error("Failed to send audio - WebSocket connection not available", {
          conversationId,
          isConnected: audioWSManager.isConnected(conversationId),
        });
        throw new Error("Failed to send audio - connection not available");
      }

      // Clear the buffer
      buffer.chunks = [];
      buffer.totalSize = 0;

      // Clear timer if exists
      if (buffer.timer) {
        clearTimeout(buffer.timer);
        buffer.timer = undefined;
      }
    } catch (error: any) {
      logger.error("Failed to flush audio buffer", {
        error: error.message,
        conversationId,
        bufferSize: buffer.totalSize,
      });
      throw error;
    }
  }

  /**
   * Publish state change via WebSocket
   */
  async publishState(config: StatePublishConfig): Promise<void> {
    const audioWSManager = getAudioWebSocketManager?.();

    if (!audioWSManager) {
      logger.warn("WebSocket manager not available - state will not be published", {
        conversationId: config.conversationId,
        state: config.state,
      });
      return; // Silently return for now during testing
    }

    try {
      // If this is NOVA_SPEECH_ENDED, flush any buffered audio first
      if (config.state === "SPEECH_ENDED") {
        await this.flushBuffer(config.conversationId);
      }

      // Send state as control message
      const success = audioWSManager.sendControl(config.conversationId, {
        type: "AUDIO_STATE",
        state: config.state,
        message: config.message,
        metadata: config.metadata,
        ...config.additionalMetadata,
      });

      if (!success) {
        throw new Error("Failed to send state - connection not available");
      }

      logger.debug("State published via WebSocket", {
        conversationId: config.conversationId,
        state: config.state,
      });
    } catch (error: any) {
      logger.error("Failed to publish state via WebSocket", {
        error: error.message,
        conversationId: config.conversationId,
        state: config.state,
      });
      throw error;
    }
  }

  /**
   * Check if WebSocket is available for a session
   */
  isAvailable(conversationId: string): boolean {
    const audioWSManager = getAudioWebSocketManager?.();
    return audioWSManager?.isConnected(conversationId) || false;
  }

  /**
   * Clean up buffers for a session
   */
  async cleanup(conversationId: string): Promise<void> {
    // Flush any remaining chunks
    await this.flushBuffer(conversationId);

    // Remove buffer from map
    const buffer = this.chunkBuffers.get(conversationId);
    if (buffer) {
      if (buffer.timer) {
        clearTimeout(buffer.timer);
      }
      this.chunkBuffers.delete(conversationId);

      logger.debug("Cleaned up audio buffer", {
        conversationId,
        hadPendingChunks: buffer.chunks.length > 0,
      });
    }
  }
}
