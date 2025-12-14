/**
 * Simple text input event builder for Nova Speech
 * Used to send non-interactive text input (interactive: false)
 * This triggers Nova to respond immediately with audio
 *
 * Per AWS docs: TEXT input should have interactive: false
 * AUDIO input should have interactive: true
 */

import { v4 as uuid } from "uuid";

export interface TextContentStartEvent {
  event: {
    contentStart: {
      promptName: string;
      contentName: string;
      type: "TEXT";
      interactive: true;
      role: "USER";
      textInputConfiguration: {
        mediaType: "text/plain";
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

export interface TextContentEndEvent {
  event: {
    contentEnd: {
      promptName: string;
      contentName: string;
    };
  };
}

/**
 * Builds simple text input events for Nova Speech
 * Used for initial requests that trigger immediate audio response
 * Uses interactive: false per AWS documentation
 */
export class TextBuilder {
  /**
   * Creates a content start event for simple text input
   */
  static createContentStart(promptName: string, contentName: string): TextContentStartEvent {
    const event: TextContentStartEvent = {
      event: {
        contentStart: {
          promptName,
          contentName,
          type: "TEXT",
          interactive: true,
          role: "USER",
          textInputConfiguration: {
            mediaType: "text/plain",
          },
        },
      },
    };
    console.log("🎯 TEXT INPUT START EVENT:", JSON.stringify(event, null, 2));
    return event;
  }

  /**
   * Creates a text input event containing the user message
   */
  static createTextInput(promptName: string, contentName: string, content: string): TextInputEvent {
    console.log(`📊 TEXT INPUT: Length=${content.length}, Content="${content}"`);

    const event: TextInputEvent = {
      event: {
        textInput: {
          promptName,
          contentName,
          content,
        },
      },
    };
    console.log("🎯 TEXT INPUT EVENT:", JSON.stringify(event, null, 2));
    return event;
  }

  /**
   * Creates a content end event for simple text input
   */
  static createContentEnd(promptName: string, contentName: string): TextContentEndEvent {
    const event: TextContentEndEvent = {
      event: {
        contentEnd: {
          promptName,
          contentName,
        },
      },
    };
    console.log("🎯 TEXT INPUT END EVENT:", JSON.stringify(event, null, 2));
    return event;
  }

  /**
   * Creates all simple text input events
   * This is used for initial requests that trigger Nova to respond immediately
   */
  static buildTextInputEvents(
    promptName: string,
    text: string
  ): Array<TextContentStartEvent | TextInputEvent | TextContentEndEvent> {
    const contentName = uuid();

    return [
      this.createContentStart(promptName, contentName),
      this.createTextInput(promptName, contentName, text),
      this.createContentEnd(promptName, contentName),
    ];
  }
}
