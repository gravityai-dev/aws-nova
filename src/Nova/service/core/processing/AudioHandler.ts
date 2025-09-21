/**
 * Audio handler for Nova Speech response processing
 */

import { getPlatformDependencies } from "@gravityai-dev/plugin-base";
import { AudioPublisher } from "../../io/redis/publishers/AudioPublisher";
import { StreamingMetadata, AudioState } from "../../api/types";

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

    AudioPublisher.publishState({
      state: "NOVA_SPEECH_STARTED",
      sessionId,
      metadata,
      message: "Nova has started speaking - microphone should be muted",
    }).catch((error: any) => {
      logger.error("Failed to publish NOVA_SPEECH_STARTED", { error: error.message });
    });
  }

  /**
   * Buffer audio chunk and flush when appropriate
   */
  bufferAudioChunk(audioData: string): void {
    this.audioState.buffer.push(audioData);
    this.audioState.size += audioData.length;

    // Clear any existing timeout
    if (this.audioState.timeout) {
      clearTimeout(this.audioState.timeout);
      this.audioState.timeout = null;
    }

    // Flush if we've reached target size
    if (this.audioState.size >= AUDIO_BUFFER_TARGET_SIZE) {
      this.flushAudioBuffer();
    } else {
      // Set timeout to flush after max delay
      this.audioState.timeout = setTimeout(() => {
        this.flushAudioBuffer();
      }, AUDIO_BUFFER_MAX_DELAY);
    }
  }

  /**
   * Mark audio generation as complete
   */
  markAudioComplete(): void {
    this.audioState.generationComplete = true;
    // Flush any remaining audio
    if (this.audioState.buffer.length > 0) {
      this.flushAudioBuffer();
    }
  }

  /**
   * Handle audio content end - send final state
   */
  handleAudioEnd(): void {
    const { metadata, sessionId } = this.context;

    // Flush any remaining buffered audio
    if (this.audioState.buffer.length > 0) {
      this.flushAudioBuffer();
    }

    console.log("🔇 Nova finished speaking - publishing NOVA_SPEECH_ENDED state");

    AudioPublisher.publishState({
      state: "NOVA_SPEECH_ENDED",
      sessionId,
      metadata,
      message: "Nova has finished speaking - microphone can be unmuted",
    }).catch((error: any) => {
      logger.error("Failed to publish NOVA_SPEECH_ENDED", { error: error.message });
    });
  }

  /**
   * Flush buffered audio chunks
   */
  private flushAudioBuffer(): void {
    if (this.audioState.buffer.length === 0) return;

    const { metadata, sessionId } = this.context;
    const combinedAudio = this.audioState.buffer.join("");

    const audioState = this.audioState.generationComplete ? "NOVA_SPEECH_ENDED" : "NOVA_SPEECH_STREAMING";

    AudioPublisher.publishAudio({
      audioData: combinedAudio,
      format: "lpcm",
      sourceType: "NovaSpeech",
      index: this.chunkIndex++,
      sessionId,
      metadata,
      audioState: audioState as AudioState,
    }).catch((error: any) => {
      logger.error("Failed to publish audio chunk", {
        error: error.message,
        chunkSize: combinedAudio.length,
        audioState,
      });
    });

    // Clear buffer
    this.audioState.buffer = [];
    this.audioState.size = 0;

    // Clear timeout
    if (this.audioState.timeout) {
      clearTimeout(this.audioState.timeout);
      this.audioState.timeout = null;
    }
  }

  /**
   * Get combined audio output
   */
  getAudioOutput(): string {
    // This would typically be implemented if we need to return all audio
    return "";
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.audioState.timeout) {
      clearTimeout(this.audioState.timeout);
      this.audioState.timeout = null;
    }
    this.audioState.buffer = [];
    this.audioState.size = 0;
  }
}
