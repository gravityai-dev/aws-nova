/**
 * AWS Nova Sonic Prompt End Event
 * Based on: https://docs.aws.amazon.com/nova/latest/userguide/input-events.html
 *
 * The promptEnd event signals the end of the current conversation turn.
 * It tells Nova that all input has been sent and it should start processing.
 */

export interface PromptEndEvent {
  event: {
    promptEnd: {
      promptName: string;
    };
  };
}

/**
 * Create a prompt end event to signal end of input
 * @param promptName - Must match the promptName from promptStart
 */
export function createPromptEndEvent(promptName: string): PromptEndEvent {
  const event = {
    event: {
      promptEnd: {
        promptName: promptName, // REQUIRED: Must match promptStart
      },
    },
  };
  console.log("📤 PROMPT END EVENT:", JSON.stringify(event, null, 2));
  return event;
}
