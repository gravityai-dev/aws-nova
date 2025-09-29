/**
 * Text accumulator for Nova Speech text output
 */

import { getPlatformDependencies } from "@gravityai-dev/plugin-base";
import { TextOutputEvent } from "../../io/events/outgoing/handlers";

const { createLogger } = getPlatformDependencies();

export interface TextAccumulationResult {
  transcription: string;
  assistantResponse: string;
  fullTextOutput: string;
}

/**
 * Accumulates text output from Nova Speech, separating transcription from assistant responses
 */
export class TextAccumulator {
  private transcription = ""; // Audio transcription (ASR)
  private assistantResponse = ""; // Assistant's text response
  private textOutput = "";
  private currentRole: "USER" | "ASSISTANT" | null = null;
  private isAssistantFinalResponse = false;

  private readonly logger: any;
  private readonly sessionId: string;

  constructor(
    sessionId: string, 
    loggerName: string = "TextAccumulator",
    private emit?: (output: any) => void
  ) {
    this.logger = createLogger(loggerName);
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
      // COMMENTED OUT: Not using textOutput accumulation anymore
      // this.textOutput = this.transcription; // Keep transcription, reset assistant part
    } else if (role === "USER") {
      // Clear any previous transcription when starting new user input
      this.transcription = "";
      // COMMENTED OUT: Not using textOutput accumulation anymore
      // this.textOutput = "";
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
      this.assistantResponse += textOutput.content;
    } else {
      // This is the audio transcription (ASR) - USER REQUEST
      this.transcription += textOutput.content;
      
      // Emit user request when captured
      if (this.currentRole === 'USER' && this.transcription && this.emit) {
        this.logger.info(`🎯 Emitting user request from TextAccumulator`, {
          sessionId: this.sessionId,
          userRequest: this.transcription,
          length: this.transcription.length
        });
        
        // Emit the user request as 'text' output
        this.emit({
          __outputs: {
            text: this.transcription
          }
        });
      }
    }

    // Also maintain full text output for backward compatibility
    // COMMENTED OUT: Nova likely provides full transcript at end, this causes corruption
    // this.textOutput += textOutput.content;

    this.logger.info(`📝 Text output received: {
      sessionId: '${this.sessionId}',
      type: '${this.isAssistantFinalResponse ? "ASSISTANT_RESPONSE" : "TRANSCRIPTION"}',
      currentRole: '${this.currentRole}',
      isAssistantFinal: ${this.isAssistantFinalResponse},
      contentLength: ${textOutput.content.length},
      totalLength: ${this.textOutput?.length || 0},
      transcriptionLength: ${this.transcription.length},
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
   * @deprecated Use getResults().transcription instead
   */
  getTranscription(): string {
    return this.transcription;
  }

  /**
   */
  getAssistantResponse(): string {
    return this.assistantResponse;
  }

  /**
   * Gets the full text output (for backward compatibility)
   * Now computed from separate fields instead of corrupted accumulator
   */
  getFullTextOutput(): string {
    // Return computed combination instead of corrupted textOutput
    return this.transcription + this.assistantResponse;
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
      fullTextLength: this.textOutput.length,
    };
  }
}
