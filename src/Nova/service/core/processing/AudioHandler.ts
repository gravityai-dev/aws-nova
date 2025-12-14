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
    const { metadata } = this.context;
    const conversationId = metadata.conversationId;

    console.log("🔊 Assistant started speaking - publishing SPEECH_STARTED state");
    this.audioState.generationComplete = false;

    const publisher = AudioPublisherFactory.getPublisher(conversationId);

    publisher
      .publishState({
        state: "SPEECH_STARTED",
        conversationId,
        metadata,
        message: "Assistant started speaking - microphone should be muted",
      })
      .catch((error: any) => {
        logger.error("Failed to publish SPEECH_STARTED", { error: error.message });
      });
  }

  /**
   * Handle audio chunk - just proxy it directly
   */
  async bufferAudioChunk(audioData: string): Promise<void> {
    const { metadata } = this.context;
    const conversationId = metadata.conversationId;

    const publisher = AudioPublisherFactory.getPublisher(conversationId);

    try {
      await publisher.publishAudio({
        audioData: audioData,
        format: "lpcm",
        sourceType: "NovaSpeech",
        index: this.chunkIndex++,
        conversationId,
        metadata,
        audioState: "SPEECH_STREAMING" as AudioState,
      });
    } catch (error: any) {
      logger.error("Failed to publish audio", {
        error: error.message,
        conversationId,
        index: this.chunkIndex - 1,
      });
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
    const { metadata } = this.context;
    const conversationId = metadata.conversationId;

    console.log("🔇 Assistant finished speaking - publishing SPEECH_ENDED state");

    const publisher = AudioPublisherFactory.getPublisher(conversationId);

    try {
      await publisher.publishState({
        state: "SPEECH_ENDED",
        conversationId,
        metadata,
        message: "Assistant finished speaking - microphone can be unmuted",
      });

      if (publisher.cleanup) {
        await publisher.cleanup(conversationId);
        logger.debug("Audio publisher cleanup completed", { conversationId });
      }
    } catch (error: any) {
      logger.error("Failed to publish SPEECH_ENDED or cleanup", { error: error.message });
    }
  }
}
