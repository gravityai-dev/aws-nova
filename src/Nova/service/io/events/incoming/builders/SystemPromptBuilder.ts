/**
 * System prompt event builder for Nova Speech
 */

import { v4 as uuid } from 'uuid';

export interface ContentStartEvent {
  event: {
    contentStart: {
      promptName: string;
      contentName: string;
      type: "TEXT";
      interactive: boolean;
      role: "SYSTEM" | "USER" | "ASSISTANT";
      textInputConfiguration: {
        mediaType: string;
      };
    };
  };
}

export interface TextInputEvent {
  event: {
    textInput: {
      promptName: string;
      contentName: string;
      content: string;
    };
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
 * Builds system prompt events for Nova Speech
 */
export class SystemPromptBuilder {
  /**
   * Creates a content start event for system prompt
   */
  static createContentStart(promptName: string, contentName: string): ContentStartEvent {
    const event: ContentStartEvent = {
      event: {
        contentStart: {
          promptName,
          contentName,
          type: "TEXT",
          interactive: true,
          role: "SYSTEM",
          textInputConfiguration: {
            mediaType: "text/plain",
          },
        },
      },
    };
    console.log("🎯 SYSTEM PROMPT START EVENT:", JSON.stringify(event, null, 2));
    return event;
  }

  /**
   * Creates a text input event containing the system prompt
   */
  static createTextInput(promptName: string, contentName: string, content: string): TextInputEvent {
    // Log the actual content length to debug token counting issue
    console.log(`📊 SYSTEM PROMPT STATS: Length=${content.length}, Preview="${content.substring(0, 100)}..."`);

    const event: TextInputEvent = {
      event: {
        textInput: {
          promptName,
          contentName,
          content,
        },
      },
    };
    console.log("🎯 SYSTEM PROMPT INPUT EVENT:", JSON.stringify(event, null, 2));
    return event;
  }

  /**
   * Creates a content end event for system prompt
   */
  static createContentEnd(promptName: string, contentName: string): ContentEndEvent {
    const event: ContentEndEvent = {
      event: {
        contentEnd: {
          promptName,
          contentName,
        },
      },
    };
    console.log("🎯 SYSTEM PROMPT END EVENT:", JSON.stringify(event, null, 2));
    return event;
  }

  /**
   * Creates all system prompt events
   */
  static buildSystemPromptEvents(
    promptName: string,
    systemPrompt: string
  ): Array<ContentStartEvent | TextInputEvent | ContentEndEvent> {
    const contentName = uuid();

    return [
      this.createContentStart(promptName, contentName),
      this.createTextInput(promptName, contentName, systemPrompt),
      this.createContentEnd(promptName, contentName),
    ];
  }
}
