/**
 * AWS Nova Sonic System Prompt Events
 * These events are used to send system prompts to the Nova Sonic model
 */

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
 * Content start event for system prompt
 */
export function createSystemPromptContentStart(promptName: string, contentName: string): ContentStartEvent {
  const event: ContentStartEvent = {
    event: {
      contentStart: {
        promptName: promptName,
        contentName: contentName,
        type: "TEXT",
        interactive: false,
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
 * Text input event containing the system prompt
 */
export function createSystemPromptTextInput(promptName: string, contentName: string, content: string): TextInputEvent {
  // Log the actual content length to debug token counting issue
  console.log(`📊 SYSTEM PROMPT STATS: Length=${content.length}, Preview="${content.substring(0, 100)}..."`);

  const event: TextInputEvent = {
    event: {
      textInput: {
        promptName: promptName,
        contentName: contentName,
        content: content,
      },
    },
  };
  console.log("🎯 SYSTEM PROMPT INPUT EVENT:", JSON.stringify(event, null, 2));
  return event;
}

/**
 * Content end event for system prompt
 */
export function createSystemPromptContentEnd(promptName: string, contentName: string): ContentEndEvent {
  const event: ContentEndEvent = {
    event: {
      contentEnd: {
        promptName: promptName,
        contentName: contentName,
      },
    },
  };
  console.log("🎯 SYSTEM PROMPT END EVENT:", JSON.stringify(event, null, 2));
  return event;
}

/**
 * Helper to create all system prompt events
 */
export function createSystemPromptEvents(
  promptName: string,
  systemPrompt: string
): Array<ContentStartEvent | TextInputEvent | ContentEndEvent> {
  const contentName = crypto.randomUUID();

  return [
    createSystemPromptContentStart(promptName, contentName),
    createSystemPromptTextInput(promptName, contentName, systemPrompt),
    createSystemPromptContentEnd(promptName, contentName),
  ];
}
