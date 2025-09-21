/**
 * Tool use event handler for Nova Speech output events
 */

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

/**
 * Handles tool use events from Nova Speech
 */
export class ToolUseHandler {
  /**
   * Parse tool use event from Nova Speech output
   */
  static parseToolUseEvent(data: any): ToolUseEvent | null {
    if (data?.event?.toolUse) {
      console.log("🔧 [NOVA TOOL USE EVENT]:", JSON.stringify(data, null, 2));
      return data as ToolUseEvent;
    }
    return null;
  }

  /**
   * Check if an event is a tool use event
   */
  static isToolUseEvent(data: any): data is ToolUseEvent {
    return !!data?.event?.toolUse;
  }

  /**
   * Get tool name from tool use event
   */
  static getToolName(event: ToolUseEvent): string {
    return event.event.toolUse.toolName;
  }

  /**
   * Get tool use ID from tool use event
   */
  static getToolUseId(event: ToolUseEvent): string {
    return event.event.toolUse.toolUseId;
  }

  /**
   * Parse tool input from tool use event
   */
  static parseToolInput(event: ToolUseEvent): any {
    try {
      return JSON.parse(event.event.toolUse.content);
    } catch (error) {
      console.error("Failed to parse tool input:", error);
      return null;
    }
  }

  /**
   * Get raw content from tool use event
   */
  static getRawContent(event: ToolUseEvent): string {
    return event.event.toolUse.content;
  }
}
