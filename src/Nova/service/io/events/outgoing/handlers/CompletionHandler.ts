/**
 * Completion event handler for Nova Speech
 */

export interface CompletionEndEvent {
  event: {
    completionEnd: {
      sessionId: string;
      promptName: string;
      completionId: string;
      stopReason: "END_TURN";
    };
  };
}

/**
 * Handles completion events from Nova Speech
 */
export class CompletionHandler {
  /**
   * Parse completion end event from Nova Speech output
   */
  static parseCompletionEndEvent(data: any): CompletionEndEvent | null {
    if (data?.event?.completionEnd) {
      console.log("🏁 [NOVA COMPLETION END EVENT]:", JSON.stringify(data, null, 2));
      return data as CompletionEndEvent;
    }
    return null;
  }

  /**
   * Check if an event is a completion end event
   */
  static isCompletionEndEvent(data: any): data is CompletionEndEvent {
    return !!data?.event?.completionEnd;
  }

  /**
   * Get stop reason from completion end event
   * Note: This will always return "END_TURN" as it's the only valid value
   */
  static getStopReason(event: CompletionEndEvent): "END_TURN" {
    return event.event.completionEnd.stopReason;
  }
}
