/**
 * Tool response event builder for Nova Speech
 */

import { v4 as uuid } from 'uuid';

export interface ToolContentStartEvent {
  event: {
    contentStart: {
      promptName: string;
      contentName: string;
      interactive: boolean;
      type: "TOOL";
      role: "TOOL";
      toolResultInputConfiguration: {
        toolUseId: string;
        type: "TEXT";
        textInputConfiguration: {
          mediaType: string;
        };
      };
    };
  };
}

export interface ToolResultEvent {
  event: {
    toolResult: {
      promptName: string;
      contentName: string;
      content: string;
      status: "success" | "error";
    };
  };
}

/**
 * Builds tool response events for Nova Speech
 */
export class ToolResponseBuilder {
  /**
   * Creates tool content start event
   */
  static createContentStart(promptName: string, contentName: string, toolUseId: string): ToolContentStartEvent {
    const event = {
      event: {
        contentStart: {
          promptName,
          contentName,
          interactive: false,
          type: "TOOL" as const,
          role: "TOOL" as const,
          toolResultInputConfiguration: {
            toolUseId,
            type: "TEXT" as const,
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
   * Creates tool result event
   */
  static createToolResult(promptName: string, contentName: string, toolResult: any): ToolResultEvent {
    // Nova expects the tool result content to be a stringified JSON
    // Format the results in a simple structure
    const formattedResult = {
      results: Array.isArray(toolResult) ? toolResult : [toolResult]
    };
    
    const event = {
      event: {
        toolResult: {
          promptName,
          contentName,
          content: JSON.stringify(formattedResult), // Stringify the result
          status: "success" as const
        },
      },
    };
    console.log("🔧 TOOL RESULT EVENT:", JSON.stringify(event, null, 2));
    return event;
  }

  /**
   * Creates tool content end event
   */
  static createContentEnd(promptName: string, contentName: string): any {
    const event = {
      event: {
        contentEnd: {
          promptName,
          contentName,
        },
      },
    };
    console.log("🔧 TOOL CONTENT END EVENT:", JSON.stringify(event, null, 2));
    return event;
  }

  /**
   * Creates all tool response events
   */
  static buildToolResponseEvents(promptName: string, toolUseId: string, toolResult: any): any[] {
    const contentName = uuid();

    return [
      this.createContentStart(promptName, contentName, toolUseId),
      this.createToolResult(promptName, contentName, toolResult),
      this.createContentEnd(promptName, contentName),
    ];
  }

  /**
   * Creates tool response events with custom content name
   */
  static buildToolResponseEventsWithContentName(
    promptName: string,
    contentName: string,
    toolUseId: string,
    toolResult: any
  ): any[] {
    return [
      this.createContentStart(promptName, contentName, toolUseId),
      this.createToolResult(promptName, contentName, toolResult),
      this.createContentEnd(promptName, contentName),
    ];
  }
}
