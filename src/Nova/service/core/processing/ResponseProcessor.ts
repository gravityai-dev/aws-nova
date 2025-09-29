/**
 * Response processor for Nova Speech streaming
 */

import { getPlatformDependencies } from "@gravityai-dev/plugin-base";
import { StreamUsageStats, StreamingMetadata, NovaSpeechConfig } from "../../api/types";
import { EventParser, CompletionStartEvent } from "./EventParser";
import { TextAccumulator } from "./TextAccumulator";
import { UsageStatsCollector } from "./UsageStatsCollector";
import { AudioHandler } from "./AudioHandler";
import { AudioPublisherFactory } from "../../io/publishers/AudioPublisherFactory";
import {
  ContentHandler,
  CompletionHandler,
  ToolUseHandler,
  UsageHandler,
  AudioHandler as AudioEventHandler,
  type ContentStartOutputEvent,
  type ContentEndOutputEvent,
  type CompletionEndEvent,
  type AudioOutputEvent,
  type TextOutputEvent,
  type ToolUseEvent,
  type UsageEvent,
} from "../../io/events/outgoing/handlers";

const { createLogger } = getPlatformDependencies();

interface ProcessorContext {
  metadata: StreamingMetadata;
  sessionId: string;
  logger: any;
}

export interface StreamResponseProcessor {
  isComplete(): boolean;
  isCompletionReceived(): boolean;
  getAudioOutput(): string | undefined;
  processEvent(event: any): Promise<void>;
  getUsageStats(): StreamUsageStats;
  getTextOutput(): string;
  getTranscription(): string;
  getAssistantResponse(): string;
  cleanup(): void;
  handleError(error: any): Promise<void>;
}

/**
 * Processes Nova Speech streaming responses
 */
export class NovaSpeechResponseProcessor implements StreamResponseProcessor {
  private completionReceived = false;
  private readonly context: ProcessorContext;
  private textAccumulator: TextAccumulator;
  private usageStatsCollector: UsageStatsCollector;
  private eventParser: EventParser;
  private audioHandler: AudioHandler;
  private onToolUse?: (toolUse: any) => void;
  onCompletionEnd?: () => void;
  private logger: any;

  constructor(
    metadata: StreamingMetadata,
    config: NovaSpeechConfig,
    sessionId: string,
    promptId: string,
    loggerName: string = "ResponseProcessor",
    private emit?: (output: any) => void
  ) {
    this.logger = createLogger(loggerName);

    this.context = {
      metadata,
      sessionId,
      logger: this.logger,
    };

    // Initialize components
    this.textAccumulator = new TextAccumulator(sessionId, "TextAccumulator", this.emit);
    this.usageStatsCollector = new UsageStatsCollector();
    this.eventParser = new EventParser(sessionId);
    this.audioHandler = new AudioHandler(this.context);
  }

  /**
   * Process a streaming event from Nova Speech
   */
  async processEvent(event: any): Promise<void> {
    try {
      // Parse and validate event
      const parsedEvent = this.eventParser.parseEvent(event);
      this.eventParser.validateNotErrorEvent(parsedEvent);

      // Route to appropriate handler
      await this.routeEvent(parsedEvent.originalEvent);
    } catch (error) {
      this.logger.error("Error processing event", {
        sessionId: this.context.sessionId,
        error: error instanceof Error ? error.message : error,
        event,
      });
      throw error;
    }
  }

  /**
   * Route event to appropriate handler
   */
  private async routeEvent(event: any): Promise<void> {
    // Handle completion start
    if (EventParser.isCompletionStartEvent(event)) {
      await this.handleCompletionStart(event);
      return;
    }

    // Handle content start
    if (ContentHandler.isContentStartEvent(event)) {
      await this.handleContentStart(event);
      return;
    }

    // Handle audio output
    if (AudioEventHandler.isAudioOutputEvent(event)) {
      await this.handleAudioOutput(event);
      return;
    }

    // Handle text output
    if (ContentHandler.isTextOutputEvent(event)) {
      await this.handleTextOutput(event);
      return;
    }

    // Handle content end
    if (ContentHandler.isContentEndEvent(event)) {
      await this.handleContentEnd(event);
      return;
    }

    // Handle tool use
    if (ToolUseHandler.isToolUseEvent(event)) {
      await this.handleToolUse(event);
      return;
    }

    // Handle completion end
    if (CompletionHandler.isCompletionEndEvent(event)) {
      await this.handleCompletionEnd(event);
      return;
    }

    // Handle usage event
    if (UsageHandler.isUsageEvent(event)) {
      await this.handleUsageEvent(event);
      return;
    }
  }

  /**
   * Handle completion start event
   */
  private async handleCompletionStart(event: CompletionStartEvent): Promise<void> {
    this.logger.info("Completion started", {
      sessionId: this.context.sessionId,
      completionId: event.event.completionStart.completionId,
    });
  }

  /**
   * Handle content start event
   */
  private async handleContentStart(event: ContentStartOutputEvent): Promise<void> {
    const contentType = ContentHandler.getContentType(event);
    const role = ContentHandler.getContentRole(event);

    this.logger.info("Content started", {
      sessionId: this.context.sessionId,
      contentType,
      role,
    });

    // Set role for text accumulator
    this.textAccumulator.setCurrentRole(role as "USER" | "ASSISTANT");

    // Handle audio content start
    if (ContentHandler.isAudioContent(event)) {
      this.audioHandler.handleAudioStart();
    }
  }

  /**
   * Handle audio output event
   */
  private async handleAudioOutput(event: AudioOutputEvent): Promise<void> {
    const audioData = AudioEventHandler.getAudioContent(event);
    await this.audioHandler.bufferAudioChunk(audioData);
    this.usageStatsCollector.incrementChunkCount();
  }

  /**
   * Handle text output event
   */
  private async handleTextOutput(event: TextOutputEvent): Promise<void> {
    this.textAccumulator.processTextOutput(event);
  }

  /**
   * Handle content end event
   */
  private async handleContentEnd(event: ContentEndOutputEvent): Promise<void> {
    const contentType = event.event.contentEnd.type;
    const stopReason = event.event.contentEnd.stopReason;

    this.logger.info("Content ended", {
      sessionId: this.context.sessionId,
      contentType,
      stopReason,
    });

    // Handle audio content end
    if (contentType === "AUDIO") {
      this.audioHandler.markAudioComplete();
      await this.audioHandler.handleAudioEnd();
    }
  }

  /**
   * Handle tool use event
   */
  private async handleToolUse(event: ToolUseEvent): Promise<void> {
    const toolName = ToolUseHandler.getToolName(event);
    const toolInput = ToolUseHandler.parseToolInput(event);
    const toolUseId = ToolUseHandler.getToolUseId(event);

    this.logger.info("Tool use requested", {
      sessionId: this.context.sessionId,
      toolName,
      toolUseId,
    });

    // Publish tool use event through audio stream
    const { metadata, sessionId } = this.context;
    const publishSessionId = metadata.conversationId || sessionId;
    const publisher = AudioPublisherFactory.getPublisher(publishSessionId);

    await publisher
      .publishState({
        state: "NOVA_TOOL_USE",
        sessionId: publishSessionId,
        metadata,
        message: `Nova is using tool: ${toolName}`,
        additionalMetadata: {
          toolName,
          toolUseId,
          toolInput,
        },
      })
      .catch((error: any) => {
        this.logger.error("Failed to publish NOVA_TOOL_USE", { error: error.message });
      });

    if (this.onToolUse) {
      this.onToolUse({
        toolName,
        toolInput,
        toolUseId,
      });
    }
  }

  /**
   * Handle completion end event
   */
  private async handleCompletionEnd(event: CompletionEndEvent): Promise<void> {
    this.completionReceived = true;

    this.logger.info("Completion ended", {
      sessionId: this.context.sessionId,
      completionId: event.event.completionEnd.completionId,
    });

    // Update usage stats with final text
    const textResults = this.textAccumulator.getResults();
    this.usageStatsCollector.setTextResults(textResults.transcription, textResults.assistantResponse);
    this.usageStatsCollector.setTextOutput(textResults.fullTextOutput);
    this.usageStatsCollector.setAudioOutput(this.audioHandler.getAudioOutput());

    if (this.onCompletionEnd) {
      this.onCompletionEnd();
    }
  }

  /**
   * Handle usage event
   */
  private async handleUsageEvent(event: UsageEvent): Promise<void> {
    this.usageStatsCollector.processUsageEvent(event);
  }

  /**
   * Handle error events
   */
  async handleError(error: any): Promise<void> {
    this.logger.error("Stream error", {
      sessionId: this.context.sessionId,
      error: error.message || error,
    });

    // Ensure audio state is cleaned up
    await this.audioHandler.handleAudioEnd();
  }

  // Getter methods
  isComplete(): boolean {
    return this.completionReceived;
  }

  isCompletionReceived(): boolean {
    return this.completionReceived;
  }

  getAudioOutput(): string | undefined {
    return this.audioHandler.getAudioOutput();
  }

  getUsageStats(): StreamUsageStats {
    return this.usageStatsCollector.getUsageStats();
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

  /**
   * Set tool use handler
   */
  setOnToolUse(handler: (toolUse: any) => void): void {
    this.onToolUse = handler;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.audioHandler.cleanup();
    this.textAccumulator.reset();
    this.usageStatsCollector.reset();
  }
}
