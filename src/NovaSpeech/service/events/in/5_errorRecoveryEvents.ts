/**
 * Error Recovery Events for AWS Nova
 * When errors occur, AWS recommends sending these events to clean up:
 * 1. promptEnd event
 * 2. sessionEnd event  
 * 3. contentEnd event (if audio streaming has started)
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
    sessionEnd: Record<string, never>;
  };
}

export interface ContentEndEvent {
  event: {
    contentEnd: {
      promptName: string;
      contentName: string;
    };
  };
}

/**
 * Create error recovery events to send at the start of a session
 * This can help clear any previous session state
 */
export function createErrorRecoveryEvents(promptName: string): Array<PromptEndEvent | SessionEndEvent | ContentEndEvent> {
  const events: Array<PromptEndEvent | SessionEndEvent | ContentEndEvent> = [];

  // 1. Send promptEnd to clear any previous prompt
  events.push({
    event: {
      promptEnd: {
        promptName,
      },
    },
  });

  // 2. Send sessionEnd to clear any previous session
  events.push({
    event: {
      sessionEnd: {},
    },
  });

  // 3. Send contentEnd to clear any previous content (if needed)
  events.push({
    event: {
      contentEnd: {
        promptName,
        contentName: `content-${promptName}`,
      },
    },
  });

  console.log("🔧 ERROR RECOVERY: Sending cleanup events", { promptName });
  return events;
}
