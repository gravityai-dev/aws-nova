/**
 * AWS Nova Sonic Tool Use Events (Output)
 * These events simulate Nova requesting to use a tool
 */

export interface ToolUseContentStartEvent {
  event: {
    contentStart: {
      sessionId: string;
      promptName: string;
      completionId: string;
      contentId: string;
      type: "TOOL";
      role: "TOOL";
      toolUseOutputConfiguration: {
        mediaType: "application/json";
      };
    };
  };
}

export interface ToolUseEvent {
  event: {
    toolUse: {
      sessionId: string;
      promptName: string;
      completionId: string;
      contentId: string;
      content: string; // JSON string
      toolName: string;
      toolUseId: string;
    };
  };
}

export interface ToolUseContentEndEvent {
  event: {
    contentEnd: {
      sessionId: string;
      promptName: string;
      completionId: string;
      contentId: string;
      stopReason: "TOOL_USE";
      type: "TOOL";
    };
  };
}

/**
 * Create tool use request events (simulating Nova requesting to use a tool)
 */
export function createToolUseRequestEvents(
  sessionId: string,
  promptName: string,
  toolName: string,
  toolUseId: string,
  toolInput: any
): [ToolUseContentStartEvent, ToolUseEvent, ToolUseContentEndEvent] {
  const completionId = `completion_${Date.now()}`;
  const contentId = `content_${Date.now()}`;

  const contentStart: ToolUseContentStartEvent = {
    event: {
      contentStart: {
        sessionId,
        promptName,
        completionId,
        contentId,
        type: "TOOL",
        role: "TOOL",
        toolUseOutputConfiguration: {
          mediaType: "application/json",
        },
      },
    },
  };
  console.log("🔧 TOOL USE CONTENT START EVENT (OUTPUT):", JSON.stringify(contentStart, null, 2));

  const toolUse: ToolUseEvent = {
    event: {
      toolUse: {
        sessionId,
        promptName,
        completionId,
        contentId,
        content: JSON.stringify(toolInput),
        toolName,
        toolUseId,
      },
    },
  };
  console.log("🔧 TOOL USE EVENT (OUTPUT):", JSON.stringify(toolUse, null, 2));

  const contentEnd: ToolUseContentEndEvent = {
    event: {
      contentEnd: {
        sessionId,
        promptName,
        completionId,
        contentId,
        stopReason: "TOOL_USE",
        type: "TOOL",
      },
    },
  };
  console.log("🔧 TOOL USE CONTENT END EVENT (OUTPUT):", JSON.stringify(contentEnd, null, 2));

  return [contentStart, toolUse, contentEnd];
}
