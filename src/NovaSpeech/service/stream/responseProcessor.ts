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
        this.handleCompletionEnd(jsonResponse as CompletionEndEvent);
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
    return this.totalUsage.audioOutput;
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
    // Check if the event has the audio data in a different structure

    const audioOutput = event.event.audioOutput;
    if (audioOutput.content) {
      this.logger.debug("audioOutput received", {
        sessionId: this.sessionId,
        contentId: audioOutput.contentId,
        completionId: audioOutput.completionId,
      });

      // Store the audio data
      this.totalUsage.audioOutput = audioOutput.content;
      this.totalUsage.chunk_count = (this.totalUsage.chunk_count || 0) + 1;

      console.log("✅ Audio output received and stored", {
        contentLength: audioOutput.content.length,
        contentId: audioOutput.contentId,
        completionId: audioOutput.completionId,
        contentType: typeof audioOutput.content,
        first50Chars: audioOutput.content.substring(0, 50),
        //audioOutputKeys: Object.keys(audioOutput),
        //fullEvent: JSON.stringify(event).substring(0, 200),
      });

      // Publish to Redis
      await publishAudio({
        audioData: audioOutput.content, // Already base64 encoded
        format: "lpcm",
        textReference: audioOutput.contentId || "nova-audio-output",
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

      this.totalUsage.chunk_count = (this.totalUsage.chunk_count || 0) + 1;
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

  private handleCompletionEnd(event: CompletionEndEvent): void {
    const completionEnd = event.event.completionEnd;
    // Logging handled in parseCompletionEndEvent
    this.completionReceived = true;

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
