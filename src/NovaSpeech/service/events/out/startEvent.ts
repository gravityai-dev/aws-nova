/**
 * AWS Nova Sonic Completion Start Event
 */

export interface CompletionStartEvent {
  event: {
    completionStart: {
      sessionId: string; // unique identifier
      promptName: string; // same unique identifier from promptStart event
      completionId: string; // unique identifier
    };
  };
}

/**
 * Create a completion start event
 */
export function createCompletionStartEvent(
  sessionId: string,
  promptName: string,
  completionId: string
): CompletionStartEvent {
  return {
    event: {
      completionStart: {
        sessionId,
        promptName,
        completionId
      }
    }
  };
}

/**
 * Parse completion start event from Nova Sonic output
 */
export function parseCompletionStartEvent(data: any): CompletionStartEvent | null {
  if (data?.event?.completionStart) {
    console.log("🚀 [NOVA COMPLETION START EVENT]:", JSON.stringify(data, null, 2));
    return data as CompletionStartEvent;
  }
  return null;
}

/**
 * Check if an event is a completion start event
 */
export function isCompletionStartEvent(data: any): data is CompletionStartEvent {
  return !!data?.event?.completionStart;
}
