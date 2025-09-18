import type { Logger } from "pino";
import { TextOutputEvent } from "../events/out";

export interface TextAccumulationResult {
  transcription: string;
  assistantResponse: string;
  fullTextOutput: string;
}

export class TextAccumulator {
  private transcription = ""; // Audio transcription (ASR)
  private assistantResponse = ""; // Assistant's text response
  private textOutput = "";
  private currentRole: "USER" | "ASSISTANT" | null = null;
  private isAssistantFinalResponse = false;
  
  private readonly logger: Logger;
  private readonly sessionId: string;

  constructor(logger: Logger, sessionId: string) {
    this.logger = logger;
    this.sessionId = sessionId;
  }

  /**
   * Sets the current content role from contentStart events
   */
  setCurrentRole(role: "USER" | "ASSISTANT", generationStage?: string): void {
    this.currentRole = role;
    
    // Reset assistant final response flag
    this.isAssistantFinalResponse = false;

    // For ASSISTANT role, we consider it as the assistant's response
    // regardless of generationStage (SPECULATIVE or FINAL)
    if (role === "ASSISTANT") {
      this.isAssistantFinalResponse = true;
      // Clear any previous assistant response to prevent mixing interrupted responses
      this.assistantResponse = "";
    } else if (role === "USER") {
      // Clear any previous transcription when starting new user input
      this.transcription = "";
    }
  }

  /**
   * Processes text output events and accumulates text based on current context
   */
  processTextOutput(event: TextOutputEvent): void {
    const textOutput = event.event.textOutput;
    if (!textOutput.content) return;

    // Accumulate based on current context
    if (this.isAssistantFinalResponse) {
      // This is the assistant's final text response
      this.assistantResponse += textOutput.content;
    } else {
      // This is the audio transcription (ASR)
      this.transcription += textOutput.content;
    }

    // Also maintain full text output for backward compatibility
    this.textOutput += textOutput.content;

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

  /**
   * Gets the current accumulation results
   */
  getResults(): TextAccumulationResult {
    return {
      transcription: this.transcription,
      assistantResponse: this.assistantResponse,
      fullTextOutput: this.textOutput
    };
  }

  /**
   * Gets just the transcription (user's spoken input)
   */
  getTranscription(): string {
    return this.transcription;
  }

  /**
   * Gets just the assistant's response
   */
  getAssistantResponse(): string {
    return this.assistantResponse;
  }

  /**
   * Gets the full text output (for backward compatibility)
   */
  getFullTextOutput(): string {
    return this.textOutput;
  }

  /**
   * Resets all accumulated text
   */
  reset(): void {
    this.transcription = "";
    this.assistantResponse = "";
    this.textOutput = "";
    this.currentRole = null;
    this.isAssistantFinalResponse = false;
  }

  /**
   * Gets current state for debugging
   */
  getState(): {
    currentRole: string | null;
    isAssistantFinalResponse: boolean;
    transcriptionLength: number;
    assistantResponseLength: number;
    fullTextLength: number;
  } {
    return {
      currentRole: this.currentRole,
      isAssistantFinalResponse: this.isAssistantFinalResponse,
      transcriptionLength: this.transcription.length,
      assistantResponseLength: this.assistantResponse.length,
      fullTextLength: this.textOutput.length
    };
  }
}
