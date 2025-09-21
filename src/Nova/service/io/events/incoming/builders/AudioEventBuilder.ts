/**
 * Audio event builder for Nova Speech
 */

import { v4 as uuid } from 'uuid';

export interface AudioContentStartEvent {
  event: {
    contentStart: {
      promptName: string;
      contentName: string;
      type: "AUDIO";
      interactive: boolean;
      role: "USER";
      audioInputConfiguration: {
        mediaType: string;
        sampleRateHertz: 8000 | 16000 | 24000;
        sampleSizeBits: number;
        channelCount: number;
        audioType: string;
        encoding: string;
      };
    };
  };
}

export interface AudioInputEvent {
  event: {
    audioInput: {
      promptName: string;
      contentName: string;
      content: string;
    };
  };
}

/**
 * Builds audio streaming events for Nova Speech
 */
export class AudioEventBuilder {
  /**
   * Creates a content start event for audio streaming
   */
  static createContentStart(promptName: string, contentName: string): AudioContentStartEvent {
    const event = {
      event: {
        contentStart: {
          promptName,
          contentName,
          type: "AUDIO" as const,
          interactive: true,
          role: "USER" as const,
          audioInputConfiguration: {
            mediaType: "audio/lpcm",
            sampleRateHertz: 16000 as 16000,
            sampleSizeBits: 16,
            channelCount: 1,
            audioType: "SPEECH",
            encoding: "base64",
          },
        },
      },
    };
    console.log("🎯 AUDIO CONTENT START EVENT:", JSON.stringify(event, null, 2));
    return event;
  }

  /**
   * Creates an audio input event for streaming audio chunks
   */
  static createAudioInput(promptName: string, contentName: string, audioData: string): AudioInputEvent {
    const event: AudioInputEvent = {
      event: {
        audioInput: {
          promptName,
          contentName,
          content: audioData,
        },
      },
    };

    // Log event structure without the audio content
    const logEvent = {
      event: {
        audioInput: {
          promptName: event.event.audioInput.promptName,
          contentName: event.event.audioInput.contentName,
          content: `[${audioData.length} chars]`,
        },
      },
    };
    
    return event;
  }

  /**
   * Creates a content end event for audio streaming
   */
  static createContentEnd(promptName: string, contentName: string): any {
    const event = {
      event: {
        contentEnd: {
          promptName,
          contentName,
        },
      },
    };
    console.log("🎯 AUDIO CONTENT END EVENT:", JSON.stringify(event, null, 2));
    return event;
  }

  /**
   * Chunks audio buffer into smaller pieces for streaming
   */
  static chunkAudioBuffer(audioBuffer: Buffer, chunkSizeBytes: number = 8192): string[] {
    const chunks: string[] = [];

    // Use 8KB chunks for better Nova processing
    for (let i = 0; i < audioBuffer.length; i += chunkSizeBytes) {
      const chunk = audioBuffer.slice(i, Math.min(i + chunkSizeBytes, audioBuffer.length));
      chunks.push(chunk.toString("base64"));
    }

    return chunks;
  }

  /**
   * Creates audio input events for continuous streaming
   */
  static createAudioInputEvents(promptName: string, contentName: string, audioData: Buffer | string): any[] {
    console.log(`🔥 createAudioInputEvents CALLED: promptName=${promptName}, contentName=${contentName}, audioData type=${typeof audioData}, length=${audioData?.length || 0}`);
    const events = [];

    // Process audio data
    let audioBuffer: Buffer;
    let originalBase64Length = 0;

    if (Buffer.isBuffer(audioData)) {
      audioBuffer = audioData;
    } else if (typeof audioData === "string") {
      // Assume base64 string, convert to buffer
      originalBase64Length = audioData.length;
      audioBuffer = Buffer.from(audioData, "base64");

      // Validate the audio format (16-bit PCM should have even byte count)
      if (audioBuffer.length % 2 !== 0) {
        console.warn(`⚠️ Audio buffer has odd byte count (${audioBuffer.length}), may not be valid 16-bit PCM`);
      }

      // Log audio stats for debugging
      console.log(`📊 Audio validation:`, {
        originalBase64Length,
        decodedBufferLength: audioBuffer.length,
        expectedSamples: audioBuffer.length / 2, // 16-bit = 2 bytes per sample
        durationSeconds: audioBuffer.length / 2 / 16000, // 16kHz sample rate
      });
    } else {
      throw new Error("audioData must be a Buffer or base64 string");
    }

    // Chunk audio into 32ms frames (~1KB at 16kHz) for continuous streaming
    // This matches Nova's expected audioInput frame pattern
    // 32ms at 16kHz = 512 samples = 1024 bytes (16-bit)
    const frameSize = 1024; // 32ms frames
    const chunks = this.chunkAudioBuffer(audioBuffer, frameSize);

    console.log(`📦 Creating ${chunks.length} audio frames of ~32ms each (${frameSize} bytes per frame)`);

    // Verify total chunk size matches original
    const totalChunkBytes = chunks.reduce((sum, chunk) => {
      return sum + Buffer.from(chunk, "base64").length;
    }, 0);

    if (totalChunkBytes !== audioBuffer.length) {
      console.error(
        `❌ Audio chunking error: original ${audioBuffer.length} bytes, chunks total ${totalChunkBytes} bytes`
      );
    }

    // Add ONLY audio input events (no contentStart/End)
    for (const chunk of chunks) {
      events.push(this.createAudioInput(promptName, contentName, chunk));
    }

    return events;
  }

  /**
   * Creates all audio events including start and end
   */
  static buildAudioEvents(promptName: string, audioData: Buffer | string): any[] {
    const contentName = uuid();
    const events = [];

    // Add content start
    events.push(this.createContentStart(promptName, contentName));

    // Add audio input events
    events.push(...this.createAudioInputEvents(promptName, contentName, audioData));

    // Add content end
    events.push(this.createContentEnd(promptName, contentName));

    return events;
  }
}
