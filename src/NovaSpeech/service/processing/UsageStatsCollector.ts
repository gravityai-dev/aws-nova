import { StreamUsageStats } from "../types";
import { UsageEvent } from "../events/out";

export class UsageStatsCollector {
  private totalUsage: StreamUsageStats = {
    audioOutput: "",
    chunk_count: 0,
    estimated: false,
    total_tokens: 0,
  };

  /**
   * Processes usage events from Nova Speech
   */
  processUsageEvent(event: UsageEvent): void {
    const usageEvent = event.event.usageEvent;
    
    // Use speech tokens only
    const inputSpeechTokens = usageEvent.details?.total?.input?.speechTokens || 0;
    const outputSpeechTokens = usageEvent.details?.total?.output?.speechTokens || 0;
    
    this.totalUsage.total_tokens = usageEvent.totalTokens || 0;
    this.totalUsage.inputTokens = inputSpeechTokens;
    this.totalUsage.outputTokens = outputSpeechTokens;
    this.totalUsage.estimated = false;
  }

  /**
   * Updates the audio output in usage stats
   */
  setAudioOutput(audioOutput: string): void {
    this.totalUsage.audioOutput = audioOutput;
  }

  /**
   * Sets the text output in usage stats
   */
  setTextOutput(textOutput: string): void {
    this.totalUsage.textOutput = textOutput;
  }

  /**
   * Sets transcription and assistant response
   */
  setTextResults(transcription: string, assistantResponse: string): void {
    this.totalUsage.transcription = transcription;
    this.totalUsage.assistantResponse = assistantResponse;
  }

  /**
   * Increments the chunk count
   */
  incrementChunkCount(): void {
    this.totalUsage.chunk_count = (this.totalUsage.chunk_count || 0) + 1;
  }

  /**
   * Gets the current usage statistics
   */
  getUsageStats(): StreamUsageStats {
    return { ...this.totalUsage };
  }

  /**
   * Gets a reference to the usage stats for external modification
   * (Used by AudioBufferManager to update chunk_count)
   */
  getUsageStatsRef(): StreamUsageStats {
    return this.totalUsage;
  }

  /**
   * Resets all usage statistics
   */
  reset(): void {
    this.totalUsage = {
      audioOutput: "",
      chunk_count: 0,
      estimated: false,
      total_tokens: 0,
    };
  }

  /**
   * Gets current stats summary for debugging
   */
  getSummary(): {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    chunkCount: number;
    hasAudioOutput: boolean;
    hasTextOutput: boolean;
    hasTranscription: boolean;
    hasAssistantResponse: boolean;
  } {
    return {
      totalTokens: this.totalUsage.total_tokens || 0,
      inputTokens: this.totalUsage.inputTokens || 0,
      outputTokens: this.totalUsage.outputTokens || 0,
      chunkCount: this.totalUsage.chunk_count || 0,
      hasAudioOutput: !!this.totalUsage.audioOutput,
      hasTextOutput: !!this.totalUsage.textOutput,
      hasTranscription: !!this.totalUsage.transcription,
      hasAssistantResponse: !!this.totalUsage.assistantResponse,
    };
  }
}
