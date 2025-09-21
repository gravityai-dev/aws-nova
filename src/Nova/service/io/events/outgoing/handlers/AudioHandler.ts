/**
 * Audio output event handler for Nova Speech
 */

import { AudioOutputEvent } from './ContentHandler';

/**
 * Handles audio output events from Nova Speech
 */
export class AudioHandler {
  /**
   * Parse audio output event from Nova Speech output
   */
  static parseAudioOutputEvent(data: any): AudioOutputEvent | null {
    if (data?.event?.audioOutput) {
      return data as AudioOutputEvent;
    }
    return null;
  }

  /**
   * Check if an event is an audio output event
   */
  static isAudioOutputEvent(data: any): data is AudioOutputEvent {
    return !!data?.event?.audioOutput;
  }

  /**
   * Get base64 audio content from audio output event
   */
  static getAudioContent(event: AudioOutputEvent): string {
    return event.event.audioOutput.content;
  }

  /**
   * Get audio content as buffer
   */
  static getAudioBuffer(event: AudioOutputEvent): Buffer {
    return Buffer.from(event.event.audioOutput.content, 'base64');
  }

  /**
   * Get content ID from audio output event
   */
  static getContentId(event: AudioOutputEvent): string {
    return event.event.audioOutput.contentId;
  }

  /**
   * Get session ID from audio output event
   */
  static getSessionId(event: AudioOutputEvent): string {
    return event.event.audioOutput.sessionId;
  }

  /**
   * Get prompt name from audio output event
   */
  static getPromptName(event: AudioOutputEvent): string {
    return event.event.audioOutput.promptName;
  }

  /**
   * Get completion ID from audio output event
   */
  static getCompletionId(event: AudioOutputEvent): string {
    return event.event.audioOutput.completionId;
  }

  /**
   * Calculate audio duration estimate (for 24kHz 16-bit mono PCM)
   */
  static estimateAudioDuration(event: AudioOutputEvent): number {
    const buffer = this.getAudioBuffer(event);
    // 24000 samples per second * 2 bytes per sample = 48000 bytes per second
    const bytesPerSecond = 48000;
    return buffer.length / bytesPerSecond;
  }
}
