/**
 * Audio handler for Nova Speech response processing
 */

import { getPlatformDependencies } from "@gravityai-dev/plugin-base";
import { AudioState, StreamingMetadata } from "../../api/types";
import { AudioPublisherFactory } from "../../io/publishers/AudioPublisherFactory";

const { createLogger } = getPlatformDependencies();
const logger = createLogger("AudioHandler");

// Audio buffer configuration
const AUDIO_BUFFER_TARGET_SIZE = 10240; // 10KB chunks
const AUDIO_BUFFER_MAX_DELAY = 100; // 100ms max delay

export interface AudioBufferState {
  buffer: string[];
  size: number;
  timeout: NodeJS.Timeout | null;
  generationComplete: boolean;
}

export interface ProcessorContext {
  metadata: StreamingMetadata;
  sessionId: string;
  logger?: any;
}

/**
 * Manages audio buffering and publishing for Nova Speech
 */
export class AudioHandler {
  private audioState: AudioBufferState = {
    buffer: [],
    size: 0,
    timeout: null,
    generationComplete: false,
  };

  private chunkIndex = 0;

  constructor(private context: ProcessorContext) {}

  /**
   * Handle audio content start - send NOVA_SPEECH_STARTED
   */
  handleAudioStart(): void {
    const { metadata, sessionId } = this.context;

    console.log("🔊 Nova started speaking - publishing NOVA_SPEECH_STARTED state");
    this.audioState.generationComplete = false;

    // Use conversationId for WebSocket publishing (that's what the client connects with)
    const publishSessionId = metadata.conversationId || sessionId;

    // Get appropriate publisher for this session
    const publisher = AudioPublisherFactory.getPublisher(publishSessionId);

    publisher
      .publishState({
        state: "NOVA_SPEECH_STARTED",
        sessionId: publishSessionId,
        metadata,
        message: "Nova has started speaking - microphone should be muted",
      })
      .catch((error: any) => {
        logger.error("Failed to publish NOVA_SPEECH_STARTED", { error: error.message });
      });
  }

  /**
   * Handle audio chunk - just proxy it directly
   */
  async bufferAudioChunk(audioData: string): Promise<void> {
    const { metadata, sessionId } = this.context;

    // Use conversationId for WebSocket publishing
    const publishSessionId = metadata.conversationId || sessionId;

    // Get appropriate publisher for this session
    const publisher = AudioPublisherFactory.getPublisher(publishSessionId);

    try {
      // Await the publish to provide backpressure to Nova
      await publisher.publishAudio({
        audioData: audioData,
        format: "lpcm",
        sourceType: "NovaSpeech",
        index: this.chunkIndex++,
        sessionId: publishSessionId,
        metadata,
        audioState: "NOVA_SPEECH_STREAMING" as AudioState,
      });
    } catch (error: any) {
      logger.error("Failed to publish audio", {
        error: error.message,
        sessionId,
        index: this.chunkIndex - 1,
      });
      // Don't throw - let Nova continue even if we can't publish
    }
  }

  /**
   * Mark audio generation as complete
   */
  markAudioComplete(): void {
    this.audioState.generationComplete = true;
    // No buffering, so nothing to flush
  }

  /**
   * Get audio output if available
   */
  getAudioOutput(): string {
    // No buffering, audio is sent directly - return empty string
    return "";
  }

  /**
   * Cleanup audio handler state
   */
  cleanup(): void {
    // Clear any pending timeout
    if (this.audioState.timeout) {
      clearTimeout(this.audioState.timeout);
      this.audioState.timeout = null;
    }

    // Reset audio state
    this.audioState = {
      buffer: [],
      size: 0,
      timeout: null,
      generationComplete: false,
    };

    // Reset chunk index
    this.chunkIndex = 0;

    logger.debug("AudioHandler cleaned up", {
      sessionId: this.context.sessionId,
    });
  }

  /**
   * Handle audio content end - send final state
   */
  async handleAudioEnd(): Promise<void> {
    const { metadata, sessionId } = this.context;

    console.log("🔇 Nova finished speaking - publishing NOVA_SPEECH_ENDED state");

    // Use conversationId for WebSocket publishing
    const publishSessionId = metadata.conversationId || sessionId;

    // Get appropriate publisher for this session
    const publisher = AudioPublisherFactory.getPublisher(publishSessionId);

    try {
      await publisher.publishState({
        state: "NOVA_SPEECH_ENDED",
        sessionId: publishSessionId,
        metadata,
        message: "Nova has finished speaking - microphone can be unmuted",
      });

      // Clean up any buffered audio in the publisher
      if (publisher.cleanup) {
        await publisher.cleanup(publishSessionId);
        logger.debug("Audio publisher cleanup completed", { sessionId: publishSessionId });
      }
    } catch (error: any) {
      logger.error("Failed to publish NOVA_SPEECH_ENDED or cleanup", { error: error.message });
    }
  }
}
