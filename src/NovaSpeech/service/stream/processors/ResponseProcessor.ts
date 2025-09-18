import type { Logger } from "pino";
import { StreamUsageStats, StreamingMetadata, NovaSpeechStreamConfig } from "../../types";
import { EventParser } from "../../processing/EventParser";
import { TextAccumulator } from "../../processing/TextAccumulator";
import { UsageStatsCollector } from "../../processing/UsageStatsCollector";
import { ProcessorContext } from "./types";
import * as audioHandler from "./audioHandler";
import {
  UsageEvent,
  CompletionStartEvent,
  ContentStartOutputEvent,
  ContentEndOutputEvent,
  CompletionEndEvent,
  AudioOutputEvent,
  TextOutputEvent,
} from "../../events/out";

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
  private readonly context: ProcessorContext;
  private textAccumulator: TextAccumulator;
  private usageStatsCollector: UsageStatsCollector;
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
    this.context = {
      metadata,
      sessionId,
      logger,
    };

    // Initialize components
    this.eventParser = new EventParser(logger, sessionId);
    this.textAccumulator = new TextAccumulator(logger, sessionId);
    this.usageStatsCollector = new UsageStatsCollector();

    // Reset audio handler for new session
    audioHandler.resetAudioHandler();
  }

  async processEvent(jsonResponse: any): Promise<void> {
    try {
      // Parse and validate the event
      const parsed = this.eventParser.parseEvent(jsonResponse);
      this.eventParser.validateNotErrorEvent(parsed);

      // Route events to appropriate handlers
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
          // COMMENTED OUT: Nova provides final usage stats at end, no need to accumulate
          // this.usageStatsCollector.processUsageEvent(jsonResponse as UsageEvent);
          break;

        case "streamComplete":
          // Logging handled in EventParser
          break;

        default:
          this.context.logger.warn(`Unhandled event type: ${parsed.type}`, {
            sessionId: this.context.sessionId,
          });
      }
    } catch (error) {
      this.context.logger.error("Error processing event", {
        sessionId: this.context.sessionId,
        error,
      });
      throw error;
    }
  }

  private async handleContentStart(event: ContentStartOutputEvent): Promise<void> {
    const contentStart = event.event.contentStart;

    // Set role in text accumulator
    this.textAccumulator.setCurrentRole(contentStart.role as "USER" | "ASSISTANT");

    // Handle audio content start
    if (contentStart.type === "AUDIO" && contentStart.role === "ASSISTANT" && contentStart.audioOutputConfiguration) {
      audioHandler.handleAudioStart(this.context);
    }

    // Handle text content start
    if (contentStart.type === "TEXT" && contentStart.textOutputConfiguration) {
      console.log("🎯 CONTENT START EVENT:", {
        sessionId: this.context.sessionId,
        role: contentStart.role,
        type: contentStart.type,
        contentId: contentStart.contentId,
        additionalModelFields: contentStart.additionalModelFields,
      });

      this.context.logger.info("📝 Text output starting", {
        sessionId: this.context.sessionId,
        mediaType: contentStart.textOutputConfiguration.mediaType,
        role: contentStart.role,
      });
    }
  }

  private async handleContentEnd(event: ContentEndOutputEvent): Promise<void> {
    const contentEnd = event.event.contentEnd;

    const usageStats = this.usageStatsCollector.getUsageStatsRef();
    console.log("✅ Content end received - audio output ready", {
      sessionId: this.context.sessionId,
      hasAudioOutput: !!usageStats.audioOutput,
      audioLength: usageStats.audioOutput?.length || 0,
      stopReason: contentEnd.stopReason,
      contentType: contentEnd.type,
    });

    // Handle interruptions - log for debugging
    if (contentEnd.stopReason === "INTERRUPTED") {
      this.context.logger.warn("🚨 Response interrupted - text accumulator will clear on next contentStart", {
        sessionId: this.context.sessionId,
        contentType: contentEnd.type,
        currentState: this.textAccumulator.getState()
      });
    }

    // Mark audio generation as complete when Nova finishes
    if (contentEnd.type === "AUDIO" && contentEnd.stopReason === "END_TURN") {
      audioHandler.markAudioGenerationComplete(this.context);
    }

    // Keep the conversation open for ALL stop reasons
    const stopReason = contentEnd.stopReason;
    console.log(`🔄 ${stopReason} detected - conversation continues, call remains open`);
  }

  private async handleAudioOutput(event: AudioOutputEvent): Promise<void> {
    const audioOutput = event.event.audioOutput;
    if (audioOutput.content) {
      audioHandler.bufferAudioChunk(audioOutput.content, this.context);
    }
  }

  private handleCompletionStart(event: CompletionStartEvent): void {
    const completionStart = event.event.completionStart;
    this.context.logger.info("🚀 Completion started", {
      sessionId: this.context.sessionId,
      promptName: completionStart.promptName,
      completionId: completionStart.completionId,
    });
  }

  private async handleCompletionEnd(event: CompletionEndEvent): Promise<void> {
    const completionEnd = event.event.completionEnd;
    this.completionReceived = true;

    // COMMENTED OUT: Nova provides final usage stats, no need to manually update
    // const textResults = this.textAccumulator.getResults();
    // this.usageStatsCollector.setTextResults(textResults.transcription, textResults.assistantResponse);
    // this.usageStatsCollector.setTextOutput(textResults.fullTextOutput);
    // this.usageStatsCollector.setAudioOutput(""); // No longer accumulating audio

    // DO NOT trigger completion callback - this is just Nova finishing its response
    console.log("🏁 CompletionEnd received - Nova finished responding, but call remains open");
  }

  private handleToolUse(event: any): void {
    const toolUse = event.event?.toolUse;
    if (toolUse) {
      this.context.logger.info("🔧 Tool use request from Nova", {
        sessionId: this.context.sessionId,
        toolName: toolUse.toolName,
        toolUseId: toolUse.toolUseId,
        contentId: toolUse.contentId,
      });

      if (this.onToolUse) {
        this.onToolUse(toolUse);
      }
    }
  }

  // Getter methods
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
}
