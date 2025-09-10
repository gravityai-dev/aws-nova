import * as crypto from "crypto";

/**
 * Create tool content start event
 */
export function createToolContentStart(promptName: string, contentName: string, toolUseId: string): any {
  const event = {
    event: {
      contentStart: {
        promptName: promptName,
        contentName: contentName,
        interactive: false,
        type: "TOOL",
        role: "TOOL",
        toolResultInputConfiguration: {
          toolUseId: toolUseId,
          type: "TEXT",
          textInputConfiguration: {
            mediaType: "text/plain",
          },
        },
      },
    },
  };
  console.log("🔧 TOOL CONTENT START EVENT:", JSON.stringify(event, null, 2));
  return event;
}

/**
 * Create tool result event
 */
export function createToolResult(promptName: string, contentName: string, toolResult: any): any {
  // Nova expects the tool result content to be a stringified JSON
  // Format the results in a simple structure
  const formattedResult = {
    results: Array.isArray(toolResult) ? toolResult : [toolResult]
  };
  
  const event = {
    event: {
      toolResult: {
        promptName: promptName,
        contentName: contentName,
        content: JSON.stringify(formattedResult), // Stringify the result
        status: "success"
      },
    },
  };
  console.log("🔧 TOOL RESULT EVENT:", JSON.stringify(event, null, 2));
  return event;
}

/**
 * Create tool content end event
 */
export function createToolContentEnd(promptName: string, contentName: string): any {
  const event = {
    event: {
      contentEnd: {
        promptName: promptName,
        contentName: contentName,
      },
    },
  };
  console.log("🔧 TOOL CONTENT END EVENT:", JSON.stringify(event, null, 2));
  return event;
}

/**
 * Helper to create all tool streaming events
 */
export function createToolStreamingEvents(promptName: string, toolUseId: string, toolResult: any): any[] {
  const contentName = crypto.randomUUID();

  return [
    createToolContentStart(promptName, contentName, toolUseId),
    createToolResult(promptName, contentName, toolResult),
    createToolContentEnd(promptName, contentName),
  ];
}

/**
 * Create tool streaming events with custom content name
 */
export function createToolStreamingEventsWithContentName(
  promptName: string,
  contentName: string,
  toolUseId: string,
  toolResult: any
): any[] {
  return [
    createToolContentStart(promptName, contentName, toolUseId),
    createToolResult(promptName, contentName, toolResult),
    createToolContentEnd(promptName, contentName),
  ];
}
