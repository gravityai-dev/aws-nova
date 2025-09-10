/**
 * Completion End Event - Signals the end of a completion
 */
export interface CompletionEndEvent {
  event: {
    completionEnd: {
      sessionId: string;
      promptName: string;
      completionId: string;
      stopReason: "END_TURN" | "PARTIAL_TURN" | "INTERRUPTED" | "TOOL_USE";
    };
  };
}

/**
 * Parse completion end event from Nova Speech output
 */
export function parseCompletionEndEvent(data: any): CompletionEndEvent | null {
  if (data?.event?.completionEnd) {
    console.log("🏁 [NOVA COMPLETION END EVENT]:", JSON.stringify(data, null, 2));
    return data as CompletionEndEvent;
  }
  return null;
}

/**
 * Check if an event is a completion end event
 */
export function isCompletionEndEvent(data: any): data is CompletionEndEvent {
  return !!data?.event?.completionEnd;
}
