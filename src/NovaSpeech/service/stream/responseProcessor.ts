import type { Logger } from "pino";
import { StreamUsageStats, StreamingMetadata, NovaSpeechStreamConfig } from "../types";
import { EventParser } from "../processing/EventParser";
import { TextAccumulator } from "../processing/TextAccumulator";
import { UsageStatsCollector } from "../processing/UsageStatsCollector";
import { publishAudioChunk } from "../redis/publishAudioChunk";
import {
  UsageEvent,
  CompletionStartEvent,
  ContentStartOutputEvent,
  ContentEndOutputEvent,
  CompletionEndEvent,
  AudioOutputEvent,
  TextOutputEvent,
} from "../events/out";

export interface StreamResponseProcessor {
  isComplete(): boolean;
  isCompletionReceived(): boolean;
  getAudioOutput(): string | undefined;
  processEvent(event: any): Promise<void>;
  getUsageStats(): StreamUsageStats;
  getTextOutput(): string;
  getTranscription(): string;
  getAssistantResponse(): string;
}

export class NovaSpeechResponseProcessor implements StreamResponseProcessor {
  private completionReceived = false;
  private readonly sessionId: string;
  private metadata: StreamingMetadata;
  private logger: any;
  private textAccumulator: TextAccumulator;
  private usageStatsCollector: UsageStatsCollector;
  private audioBuffer: string[] = [];
  private audioBufferSize: number = 0;
  private audioBufferTimeout: NodeJS.Timeout | null = null;
  private readonly AUDIO_BUFFER_TARGET_SIZE = 10240; // 4x larger chunks (10KB)
  private readonly AUDIO_BUFFER_MAX_DELAY = 100; // 100ms max delay
  private config: NovaSpeechStreamConfig;
  private eventParser: EventParser;
  private onToolUse?: (toolUse: any) => void;
  onCompletionEnd?: () => void;

  constructor(
    metadata: StreamingMetadata,
    config: NovaSpeechStreamConfig,
    logger: Logger,
    sessionId: string,
    promptId: string
  ) {
    this.metadata = metadata;
    this.config = config;
    this.logger = logger;
    this.sessionId = sessionId;

    // Initialize extracted components
    this.eventParser = new EventParser(logger, sessionId);
    this.textAccumulator = new TextAccumulator(logger, sessionId);
    this.usageStatsCollector = new UsageStatsCollector();
  }

  async processEvent(jsonResponse: any): Promise<void> {
    try {
      // Parse and validate the event
      const parsed = this.eventParser.parseEvent(jsonResponse);
      this.eventParser.validateNotErrorEvent(parsed);

      // Handle normal events using extracted components
      switch (parsed.type) {
        case "completionStart":
          this.handleCompletionStart(jsonResponse as CompletionStartEvent);
          break;

        case "contentStart":
          await this.handleContentStart(jsonResponse as ContentStartOutputEvent);
          break;

        case "contentEnd":
          await this.handleContentEnd(jsonResponse as ContentEndOutputEvent);
          break;

        case "audioOutput":
          await this.handleAudioOutput(jsonResponse as AudioOutputEvent);
          break;

        case "textOutput":
          this.textAccumulator.processTextOutput(jsonResponse as TextOutputEvent);
          break;

        case "toolUse":
          this.handleToolUse(jsonResponse);
          break;

        case "completionEnd":
          await this.handleCompletionEnd(jsonResponse as CompletionEndEvent);
          break;

        case "usageEvent":
          this.usageStatsCollector.processUsageEvent(jsonResponse as UsageEvent);
          break;

        case "streamComplete":
          // Logging handled in EventParser
          break;

        default:
          this.logger.warn(`Unhandled event type: ${parsed.type}`, { sessionId: this.sessionId });
      }
    } catch (error) {
      this.logger.error("Error processing event", { sessionId: this.sessionId, error });
      throw error;
    }
  }

  private async handleContentStart(event: ContentStartOutputEvent): Promise<void> {
    const contentStart = event.event.contentStart;

    // Set role in text accumulator
    this.textAccumulator.setCurrentRole(contentStart.role as "USER" | "ASSISTANT");

    // Handle audio content start
    if (contentStart.type === "AUDIO" && contentStart.audioOutputConfiguration) {
      // Audio handling is managed by AudioBufferManager
    }

    // Handle text content start
    if (contentStart.type === "TEXT" && contentStart.textOutputConfiguration) {
      console.log("🎯 CONTENT START EVENT:", {
        sessionId: this.sessionId,
        role: contentStart.role,
        type: contentStart.type,
        contentId: contentStart.contentId,
        additionalModelFields: contentStart.additionalModelFields,
      });

      this.logger.info("📝 Text output starting", {
        sessionId: this.sessionId,
        mediaType: contentStart.textOutputConfiguration.mediaType,
        role: contentStart.role,
      });
    }
  }

  private async handleContentEnd(event: ContentEndOutputEvent): Promise<void> {
    const contentEnd = event.event.contentEnd;

    const usageStats = this.usageStatsCollector.getUsageStatsRef();
    console.log("✅ Content end received - audio output ready", {
      sessionId: this.sessionId,
      hasAudioOutput: !!usageStats.audioOutput,
      audioLength: usageStats.audioOutput?.length || 0,
      stopReason: contentEnd.stopReason,
    });

    // No longer needed - audio is published directly

    // Keep the conversation open for ALL stop reasons - don't close the call
    const stopReason = contentEnd.stopReason;
    console.log(`🔄 ${stopReason} detected - conversation continues, call remains open`);
    // Don't synthesize completionEnd - let the conversation continue
  }

  // Usage events are now handled by UsageStatsCollector

  getUsageStats(): StreamUsageStats {
    const stats = this.usageStatsCollector.getUsageStats();
    const textResults = this.textAccumulator.getResults();

    return {
      ...stats,
      textOutput: textResults.fullTextOutput,
      transcription: textResults.transcription,
      assistantResponse: textResults.assistantResponse,
      audioOutput: "", // No longer accumulating audio
    };
  }

  getTextOutput(): string {
    return this.textAccumulator.getFullTextOutput();
  }

  getTranscription(): string {
    return this.textAccumulator.getTranscription();
  }

  getAssistantResponse(): string {
    return this.textAccumulator.getAssistantResponse();
  }

  isCompletionReceived(): boolean {
    return this.completionReceived;
  }

  getAudioOutput(): string {
    return ""; // No longer accumulating audio
  }

  isComplete(): boolean {
    return this.completionReceived;
  }

  private async handleAudioOutput(event: AudioOutputEvent): Promise<void> {
    const audioOutput = event.event.audioOutput;
    if (audioOutput.content) {
      // Add to buffer instead of publishing immediately
      this.audioBuffer.push(audioOutput.content);
      this.audioBufferSize += audioOutput.content.length;

      // Clear existing timeout
      if (this.audioBufferTimeout) {
        clearTimeout(this.audioBufferTimeout);
      }

      // Check if we should flush
      if (this.audioBufferSize >= this.AUDIO_BUFFER_TARGET_SIZE) {
        // Buffer is full, flush immediately
        await this.flushAudioBuffer();
      } else {
        // Set timeout to flush if no more chunks arrive
        this.audioBufferTimeout = setTimeout(() => {
          this.flushAudioBuffer();
        }, this.AUDIO_BUFFER_MAX_DELAY);
      }
    }
  }

  private async flushAudioBuffer(): Promise<void> {
    if (this.audioBuffer.length === 0) return;

    // Clear timeout
    if (this.audioBufferTimeout) {
      clearTimeout(this.audioBufferTimeout);
      this.audioBufferTimeout = null;
    }

    // Combine all buffered chunks
    const combinedAudio = this.audioBuffer.join('');
    const totalSize = this.audioBufferSize;

    // Clear buffer
    this.audioBuffer = [];
    this.audioBufferSize = 0;

    try {
      // Publish the combined chunk
      publishAudioChunk({
        audioData: combinedAudio,
        format: "lpcm",
        sourceType: "NovaSpeech",
        index: 0,
        chatId: this.metadata.chatId,
        conversationId: this.metadata.conversationId,
        userId: this.metadata.userId,
        providerId: this.metadata.providerId || "nova-sonic",
        sessionId: this.sessionId,
        metadata: {
          textReference: `nova-audio`,
          workflowId: this.metadata.workflowId,
          workflowRunId: this.metadata.executionId,
          chunkCount: this.audioBuffer.length,
          totalSize: totalSize,
        },
      }).catch((error) => {
        this.logger.error("Failed to publish buffered audio chunk", {
          error: error.message,
          chatId: this.metadata.chatId,
          bufferSize: totalSize,
        });
      });
    } catch (error: any) {
      this.logger.error("Failed to flush audio buffer", {
        error: error.message,
        chatId: this.metadata.chatId,
      });
    }
  }

  private handleCompletionStart(event: CompletionStartEvent): void {
    const completionStart = event.event.completionStart;
    // Logging handled in parseCompletionStartEvent
    this.logger.info("🚀 Completion started", {
      sessionId: this.sessionId,
      promptName: completionStart.promptName,
      completionId: completionStart.completionId,
    });
  }

  private async handleCompletionEnd(event: CompletionEndEvent): Promise<void> {
    const completionEnd = event.event.completionEnd;
    this.completionReceived = true;

    // Update final usage stats with accumulated text
    const textResults = this.textAccumulator.getResults();
    this.usageStatsCollector.setTextResults(textResults.transcription, textResults.assistantResponse);
    this.usageStatsCollector.setTextOutput(textResults.fullTextOutput);
    this.usageStatsCollector.setAudioOutput(""); // No longer accumulating audio

    // DO NOT trigger completion callback - this is just Nova finishing its response, not the call ending
    console.log("🏁 CompletionEnd received - Nova finished responding, but call remains open");
    // The call should only end when we receive an END_CALL control signal
  }

  private handleToolUse(event: any): void {
    const toolUse = event.event?.toolUse;
    if (toolUse) {
      this.logger.info("🔧 Tool use request from Nova", {
        sessionId: this.sessionId,
        toolName: toolUse.toolName,
        toolUseId: toolUse.toolUseId,
        contentId: toolUse.contentId,
      });

      // Emit tool use event for external handling
      if (this.onToolUse) {
        this.onToolUse(toolUse);
      }
    }
  }
}
