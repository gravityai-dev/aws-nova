/**
 * AWS Nova Sonic Session End Event
 * Based on: https://docs.aws.amazon.com/nova/latest/userguide/input-events.html
 *
 * The sessionEnd event terminates the entire session with Nova.
 * It should only be sent after receiving the completionEnd event from Nova.
 */

export interface SessionEndEvent {
  event: {
    sessionEnd: {};
  };
}

/**
 * Create a session end event to terminate the session
 * Should only be called after receiving completionEnd from Nova
 */
export function createSessionEndEvent(): SessionEndEvent {
  const event = {
    event: {
      sessionEnd: {}, // No parameters needed
    },
  };
  console.log("🔚 SESSION END EVENT:", JSON.stringify(event, null, 2));
  return event;
}
