import type { Logger } from "pino";
import { StreamUsageStats, StreamingMetadata, NovaSpeechStreamConfig } from "../types";
import { publishAudio } from "../redis/audio";
import {
  parseOutputEvent,
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
  private totalUsage: StreamUsageStats = {
    audioOutput: "",
    chunk_count: 0,
    estimated: false,
    total_tokens: 0,
  };
  private textOutput = "";
  private transcription = ""; // Audio transcription (ASR)
  private assistantResponse = ""; // Assistant's text response
  private currentRole: "USER" | "ASSISTANT" | null = null;
  private isAssistantFinalResponse = false;
  private readonly sessionId: string;
  private readonly logger: Logger;
  private metadata: StreamingMetadata;
  private config: NovaSpeechStreamConfig;
  public onCompletionEnd?: () => void;
  public onToolUse?: (toolUse: any) => void;
  
  // Audio buffering
  private audioBuffer: string[] = [];
  private bufferTimer: NodeJS.Timeout | null = null;
  private readonly BUFFER_DURATION_MS = 300; // Buffer for 300ms
  private readonly MAX_BUFFER_SIZE = 10; // Max chunks before forced flush
  private allAudioChunks: string[] = []; // Keep all chunks for final output

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
  }

  async processEvent(jsonResponse: any): Promise<void> {
    // Parse the event using the centralized parser (which includes logging)
    const parsed = parseOutputEvent(jsonResponse);
    const eventType = parsed.type;
    const eventData = jsonResponse.event?.[Object.keys(jsonResponse.event || {})[0]];

    if (!eventType || eventType === "unknown") {
      this.logger.warn("Invalid event structure", { jsonResponse });
      return;
    }

    // Handle error events first
    if (eventType === "error") {
      throw new Error(`Nova Speech error: ${eventData.message || eventData.Message || "Unknown error"}`);
    }

    if (eventType === "modelStreamErrorException") {
      this.logger.error("Model stream error", { sessionId: this.sessionId, error: eventData });
      throw new Error(`Model stream error: ${JSON.stringify(eventData)}`);
    }

    if (eventType === "internalServerException") {
      this.logger.error("Internal server error", { sessionId: this.sessionId, error: eventData });
      throw new Error(`Internal server error: ${JSON.stringify(eventData)}`);
    }

    // Handle normal events
    switch (eventType) {
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
        this.handleTextOutput(jsonResponse as TextOutputEvent);
        break;

      case "toolUse":
        this.handleToolUse(jsonResponse);
        break;

      case "completionEnd":
        await this.handleCompletionEnd(parsed as CompletionEndEvent);
        break;

      case "usageEvent":
        this.handleUsageEvent(jsonResponse as UsageEvent);
        break;

      case "streamComplete":
        // Logging handled in parseOutputEvent
        break;

      default:
        this.logger.warn(`Unhandled event type: ${eventType}`, { sessionId: this.sessionId });
    }
  }

  private async handleContentStart(event: ContentStartOutputEvent): Promise<void> {
    const contentStart = event.event.contentStart;
    // Logging handled in parseContentStartEvent

    // Track the current role
    this.currentRole = contentStart.role as "USER" | "ASSISTANT";

    // Reset assistant final response flag
    this.isAssistantFinalResponse = false;

    // For ASSISTANT role, we consider it as the assistant's response
    // regardless of generationStage (SPECULATIVE or FINAL)
    if (contentStart.role === "ASSISTANT") {
      this.isAssistantFinalResponse = true;
    }

    // Handle audio content start
    if (contentStart.type === "AUDIO" && contentStart.audioOutputConfiguration) {
    }

    // Handle text content start
    if (contentStart.type === "TEXT" && contentStart.textOutputConfiguration) {
      console.log("🎯 CONTENT START EVENT:", {
        sessionId: this.sessionId,
        role: contentStart.role,
        type: contentStart.type,
        contentId: contentStart.contentId,
        additionalModelFields: contentStart.additionalModelFields,
        isAssistantFinal: this.isAssistantFinalResponse,
      });

      this.logger.info("📝 Text output starting", {
        sessionId: this.sessionId,
        mediaType: contentStart.textOutputConfiguration.mediaType,
        role: contentStart.role,
        isAssistantFinal: this.isAssistantFinalResponse,
      });
    }
  }

  private handleContentEnd(event: ContentEndOutputEvent): void {
    const contentEnd = event.event.contentEnd;
    // Logging handled in parseContentEndEvent
    this.completionReceived = true;

    console.log("✅ Content end received - audio output ready", {
      sessionId: this.sessionId,
      hasAudioOutput: !!this.totalUsage.audioOutput,
      audioLength: this.totalUsage.audioOutput?.length || 0,
      stopReason: contentEnd.stopReason,
    });

    // When we get END_TURN, synthesize a completionEnd event since Nova doesn't reliably send it
    if (contentEnd.stopReason === "END_TURN") {
      console.log("🏁 END_TURN detected - synthesizing completionEnd event");

      const completionEndEvent = {
        event: {
          completionEnd: {
            sessionId: contentEnd.sessionId,
            promptName: contentEnd.promptName,
            completionId: contentEnd.completionId,
            stopReason: contentEnd.stopReason,
          },
        },
      };

      // Process the synthetic completionEnd event
      this.handleCompletionEnd(completionEndEvent);
    }
  }

  private handleUsageEvent(event: UsageEvent): void {
    const usageEvent = event.event.usageEvent;
    
    // Use speech tokens only
    const inputSpeechTokens = usageEvent.details?.total?.input?.speechTokens || 0;
    const outputSpeechTokens = usageEvent.details?.total?.output?.speechTokens || 0;
    
    this.totalUsage.total_tokens = usageEvent.totalTokens || 0;
    this.totalUsage.inputTokens = inputSpeechTokens;
    this.totalUsage.outputTokens = outputSpeechTokens;
    this.totalUsage.estimated = false;
  }

  getUsageStats(): StreamUsageStats {
    return {
      ...this.totalUsage,
      transcription: this.transcription,
      assistantResponse: this.assistantResponse,
    };
  }

  getTextOutput(): string {
    return this.totalUsage.textOutput || "";
  }

  getTranscription(): string {
    return this.transcription;
  }

  getAssistantResponse(): string {
    return this.assistantResponse;
  }

  isCompletionReceived(): boolean {
    return this.completionReceived;
  }

  getAudioOutput(): string | undefined {
    // Return all accumulated audio chunks
    return this.allAudioChunks.join('');
  }

  isComplete(): boolean {
    return this.completionReceived;
  }

  private handleTextOutput(event: TextOutputEvent): void {
    const textOutput = event.event.textOutput;
    if (textOutput.content) {
      // Accumulate based on current context
      if (this.isAssistantFinalResponse) {
        // This is the assistant's final text response
        this.assistantResponse += textOutput.content;
      } else {
        // This is the audio transcription (ASR)
        this.transcription += textOutput.content;
      }

      // Also maintain full text output for backward compatibility
      this.textOutput = (this.textOutput || "") + textOutput.content;
      // Store in totalUsage for consistency
      this.totalUsage.textOutput = this.textOutput;

      this.logger.info(`📝 Text output received: {
  sessionId: '${this.sessionId}',
  type: '${this.isAssistantFinalResponse ? "ASSISTANT_RESPONSE" : "TRANSCRIPTION"}',
  currentRole: '${this.currentRole}',
  isAssistantFinal: ${this.isAssistantFinalResponse},
  contentLength: ${textOutput.content.length},
  totalLength: ${this.textOutput?.length || 0},
  transcriptionLength: ${this.transcription.length},
  assistantResponseLength: ${this.assistantResponse.length},
  preview: '${textOutput.content.substring(0, 100)}'
}`);
    }
  }

  private async handleAudioOutput(event: AudioOutputEvent): Promise<void> {
    const audioOutput = event.event.audioOutput;
    if (audioOutput.content) {
      this.logger.debug("audioOutput received", {
        sessionId: this.sessionId,
        contentId: audioOutput.contentId,
        completionId: audioOutput.completionId,
        bufferSize: this.audioBuffer.length,
      });

      // Add to buffer
      this.audioBuffer.push(audioOutput.content);
      
      // Keep track of all chunks for final output
      this.allAudioChunks.push(audioOutput.content);

      // Check if we should flush
      if (this.audioBuffer.length >= this.MAX_BUFFER_SIZE) {
        // Force flush if buffer is too large
        await this.flushAudioBuffer();
      } else if (!this.bufferTimer) {
        // Start timer for time-based flush
        this.bufferTimer = setTimeout(() => {
          this.flushAudioBuffer();
        }, this.BUFFER_DURATION_MS);
      }
    }
  }

  private async flushAudioBuffer(): Promise<void> {
    if (this.audioBuffer.length === 0) return;

    // Clear timer
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
      this.bufferTimer = null;
    }

    // Concatenate all buffered chunks
    const combinedAudio = this.audioBuffer.join('');
    const chunkCount = this.audioBuffer.length;
    
    console.log("🎵 Flushing audio buffer", {
      chunks: chunkCount,
      totalLength: combinedAudio.length,
      avgChunkSize: Math.round(combinedAudio.length / chunkCount),
    });

    // Publish combined audio
    await publishAudio({
      audioData: combinedAudio, // Already base64 encoded
      format: "lpcm",
      textReference: `nova-audio-batch-${this.totalUsage.chunk_count}`,
      sourceType: "NovaSpeech",
      chatId: this.metadata.chatId,
      conversationId: this.metadata.conversationId,
      userId: this.metadata.userId,
      providerId: this.metadata.providerId || "nova-sonic",
      workflowId: this.metadata.workflowId,
      workflowRunId: this.metadata.executionId,
      redisChannel: this.config.redisChannel,
      index: this.totalUsage.chunk_count,
    });

    // Update chunk count
    this.totalUsage.chunk_count = (this.totalUsage.chunk_count || 0) + 1;
    
    // Clear buffer
    this.audioBuffer = [];
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
    // Logging handled in parseCompletionEndEvent
    this.completionReceived = true;

    // Flush any remaining audio before completion
    await this.flushAudioBuffer();

    // Always trigger completion callback on completionEnd
    if (this.onCompletionEnd) {
      console.log("🏁 CompletionEnd received - triggering completion callback");
      this.onCompletionEnd();
    }
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
