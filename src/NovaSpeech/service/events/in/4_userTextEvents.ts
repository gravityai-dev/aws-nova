import * as crypto from "crypto";

/**
 * Create user text content start event
 */
export function createUserTextContentStart(promptName: string, contentName: string): any {
  const event = {
    event: {
      contentStart: {
        promptName: promptName,
        contentName: contentName,
        type: "TEXT",
        interactive: true,
        role: "USER",
        textInputConfiguration: {
          mediaType: "text/plain",
        },
      },
    },
  };
  console.log("🎯 USER TEXT START EVENT:", JSON.stringify(event, null, 2));
  return event;
}

/**
 * Create user text input event
 */
export function createUserTextInput(promptName: string, contentName: string, text: string): any {
  const event = {
    event: {
      textInput: {
        promptName: promptName,
        contentName: contentName,
        content: text,
      },
    },
  };
  console.log("🎯 USER TEXT INPUT EVENT:", JSON.stringify(event, null, 2));
  return event;
}

/**
 * Create user text content end event
 */
export function createUserTextContentEnd(promptName: string, contentName: string): any {
  const event = {
    event: {
      contentEnd: {
        promptName: promptName,
        contentName: contentName,
      },
    },
  };
  console.log("🎯 USER TEXT END EVENT:", JSON.stringify(event, null, 2));
  return event;
}

/**
 * Helper to create all user text events
 */
export function createUserTextEvents(promptName: string, userText: string): any[] {
  const contentName = crypto.randomUUID();

  return [
    createUserTextContentStart(promptName, contentName),
    createUserTextInput(promptName, contentName, userText),
    createUserTextContentEnd(promptName, contentName),
  ];
}
