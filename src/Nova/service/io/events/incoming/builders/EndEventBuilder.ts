/**
 * End event builders for Nova Speech
 */

export interface PromptEndEvent {
  event: {
    promptEnd: {
      promptName: string;
    };
  };
}

export interface SessionEndEvent {
  event: {
    sessionEnd: {};
  };
}

/**
 * Builds end events for Nova Speech sessions
 */
export class EndEventBuilder {
  /**
   * Creates a prompt end event to signal end of input
   * The promptEnd event tells Nova that all input has been sent and it should start processing.
   * @param promptName - Must match the promptName from promptStart
   */
  static createPromptEnd(promptName: string): PromptEndEvent {
    const event = {
      event: {
        promptEnd: {
          promptName, // REQUIRED: Must match promptStart
        },
      },
    };
    console.log("📤 PROMPT END EVENT:", JSON.stringify(event, null, 2));
    return event;
  }

  /**
   * Creates a session end event to terminate the session
   * The sessionEnd event terminates the entire session with Nova.
   * Should only be called after receiving completionEnd from Nova.
   */
  static createSessionEnd(): SessionEndEvent {
    const event = {
      event: {
        sessionEnd: {}, // No parameters needed
      },
    };
    console.log("🔚 SESSION END EVENT:", JSON.stringify(event, null, 2));
    return event;
  }
}
