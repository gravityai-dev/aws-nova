/**
 * AWS Nova Sonic Conversation History Events (Optional)
 * Based on: https://docs.aws.amazon.com/nova/latest/userguide/input-events.html
 */

// Import types from systemPromptEvents to avoid duplication
import { ContentStartEvent, TextInputEvent, ContentEndEvent } from "./2_systemPromptEvents";

export interface HistoryMessage {
  role: "USER" | "ASSISTANT";
  content: string;
}

// Constants for history truncation
const MAX_HISTORY_CHARS = 3000; // Conservative limit for total history
const MAX_HISTORY_MESSAGES = 6; // Limit number of messages
const MAX_MESSAGE_LENGTH = 500; // Conservative limit per message

/**
 * Create content start event for history message
 */
export function createHistoryContentStart(
  promptName: string,
  contentName: string,
  role: "USER" | "ASSISTANT"
): ContentStartEvent {
  if (role !== "USER" && role !== "ASSISTANT") {
    throw new Error(`Invalid role: ${role}. Must be USER or ASSISTANT for history`);
  }

  const event: ContentStartEvent = {
    event: {
      contentStart: {
        promptName: promptName,
        contentName: contentName,
        type: "TEXT",
        interactive: true,
        role: role,
        textInputConfiguration: {
          mediaType: "text/plain",
        },
      },
    },
  };
  console.log(`🎯 HISTORY ${role} START EVENT:`, JSON.stringify(event, null, 2));
  return event;
}

/**
 * Create history events for a single message
 */
export function createHistoryMessageEvents(
  promptName: string,
  message: string,
  role: "USER" | "ASSISTANT"
): Array<ContentStartEvent | TextInputEvent | ContentEndEvent> {
  const contentName = crypto.randomUUID();
  
  // Truncate message content to avoid Nova limits
  const MAX_MESSAGE_LENGTH = 500; // Conservative limit per message
  const truncatedMessage = message.length > MAX_MESSAGE_LENGTH 
    ? message.substring(0, MAX_MESSAGE_LENGTH - 3) + "..."
    : message;

  // Create all events first
  const startEvent = createHistoryContentStart(promptName, contentName, role);
  
  const textInputEvent: TextInputEvent = {
    event: {
      textInput: {
        promptName: promptName,
        contentName: contentName,
        content: truncatedMessage,
      },
    },
  };
  console.log(`🎯 HISTORY ${role} INPUT EVENT (${truncatedMessage.length} chars):`, JSON.stringify(textInputEvent, null, 2));

  const contentEndEvent: ContentEndEvent = {
    event: {
      contentEnd: {
        promptName: promptName,
        contentName: contentName,
      },
    },
  };
  console.log(`🎯 HISTORY ${role} END EVENT:`, JSON.stringify(contentEndEvent, null, 2));

  return [
    startEvent,
    textInputEvent,
    contentEndEvent,
  ];
}

/**
 * Truncate conversation history to fit within Nova's limits
 */
export function truncateConversationHistory(
  history: HistoryMessage[],
  logger?: { warn: (message: string, data?: any) => void }
): HistoryMessage[] {
  // Start with the most recent messages
  let truncatedHistory = history.slice(-MAX_HISTORY_MESSAGES);
  let totalChars = truncatedHistory.reduce((sum, item) => sum + item.content.length, 0);

  // If still too long, remove oldest messages until under limit
  while (totalChars > MAX_HISTORY_CHARS && truncatedHistory.length > 1) {
    const removed = truncatedHistory.shift()!;
    totalChars -= removed.content.length;
    if (logger) {
      logger.warn("Truncating conversation history - removed message", {
        removedRole: removed.role,
        removedLength: removed.content.length,
      });
    }
  }

  // If a single message is still too long, truncate it
  if (truncatedHistory.length > 0 && truncatedHistory[0].content.length > MAX_HISTORY_CHARS) {
    truncatedHistory[0] = {
      ...truncatedHistory[0],
      content: truncatedHistory[0].content.substring(0, MAX_HISTORY_CHARS - 3) + "...",
    };
  }

  return truncatedHistory;
}

/**
 * Create all history events for a conversation
 */
export function createConversationHistoryEvents(
  promptName: string,
  history: HistoryMessage[],
  logger?: { warn: (message: string, data?: any) => void }
): Array<ContentStartEvent | TextInputEvent | ContentEndEvent> {
  console.log(`📚 Creating conversation history events for ${history.length} messages`);
  
  // Truncate history before creating events
  const truncatedHistory = truncateConversationHistory(history, logger);
  
  const events: Array<ContentStartEvent | TextInputEvent | ContentEndEvent> = [];

  for (const message of truncatedHistory) {
    events.push(...createHistoryMessageEvents(promptName, message.content, message.role));
  }

  console.log(`✅ Created ${events.length} history events from ${truncatedHistory.length} messages (original: ${history.length})`);
  return events;
}
