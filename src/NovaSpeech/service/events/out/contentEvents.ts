/**
 * AWS Nova Sonic Content Events (Output)
 * Based on: https://docs.aws.amazon.com/nova/latest/userguide/output-events.html
 */

export interface ContentStartOutputEvent {
  event: {
    contentStart: {
      sessionId: string;
      promptName: string;
      completionId: string;
      contentId: string;
      type: "TEXT" | "AUDIO" | "TOOL";
      role: "USER" | "ASSISTANT" | "TOOL";
      // Only present for TEXT type
      additionalModelFields?: string;
      textOutputConfiguration?: {
        mediaType: "text/plain";
      };
      // Only present for AUDIO type
      audioOutputConfiguration?: {
        mediaType: "audio/lpcm";
        sampleRateHertz: 8000 | 16000 | 24000;
        sampleSizeBits: 16;
        encoding: "base64";
        channelCount: 1;
      };
      // Only present for TOOL type
      toolUseOutputConfiguration?: {
        mediaType: "application/json";
      };
    };
  };
}

export interface AudioOutputEvent {
  event: {
    audioOutput: {
      sessionId: string;
      promptName: string;
      completionId: string;
      contentId: string;
      content: string; // base64 encoded audio data
    };
  };
}

export interface TextOutputEvent {
  event: {
    textOutput: {
      sessionId: string;
      promptName: string;
      completionId: string;
      contentId: string;
      content: string; // text content
    };
  };
}

export interface ContentEndOutputEvent {
  event: {
    contentEnd: {
      sessionId: string;
      promptName: string;
      completionId: string;
      contentId: string;
      stopReason: "PARTIAL_TURN" | "END_TURN" | "INTERRUPTED" | "TOOL_USE";
      type: "TEXT" | "AUDIO" | "TOOL";
    };
  };
}

/**
 * Parse content start event from Nova Sonic output
 */
export function parseContentStartEvent(data: any): ContentStartOutputEvent | null {
  if (data?.event?.contentStart) {
    console.log("🎯 [NOVA CONTENT START EVENT]:", JSON.stringify(data, null, 2));
    return data as ContentStartOutputEvent;
  }
  return null;
}

/**
 * Parse content end event from Nova Sonic output
 */
export function parseContentEndEvent(data: any): ContentEndOutputEvent | null {
  if (data?.event?.contentEnd) {
    console.log("🏁 [NOVA CONTENT END EVENT]:", JSON.stringify(data, null, 2));
    return data as ContentEndOutputEvent;
  }
  return null;
}

/**
 * Check if an event is a content start event
 */
export function isContentStartEvent(data: any): data is ContentStartOutputEvent {
  return !!data?.event?.contentStart;
}

/**
 * Check if an event is an audio output event
 */
export function isAudioOutputEvent(data: any): data is AudioOutputEvent {
  return !!data?.event?.audioOutput;
}

/**
 * Check if an event is a text output event
 */
export function isTextOutputEvent(data: any): data is TextOutputEvent {
  return !!data?.event?.textOutput;
}

/**
 * Parse text output event from Nova Sonic output
 */
export function parseTextOutputEvent(data: any): TextOutputEvent | null {
  if (data?.event?.textOutput) {
    console.log("📝 [NOVA TEXT OUTPUT EVENT]:", JSON.stringify(data, null, 2));
    return data as TextOutputEvent;
  }
  return null;
}

/**
 * Check if an event is a content end event
 */
export function isContentEndEvent(data: any): data is ContentEndOutputEvent {
  return !!data?.event?.contentEnd;
}

/**
 * Get content type from content start event
 */
export function getContentType(event: ContentStartOutputEvent): "TEXT" | "AUDIO" | "TOOL" {
  return event.event.contentStart.type;
}

/**
 * Check if content is audio type
 */
export function isAudioContent(event: ContentStartOutputEvent): boolean {
  return event.event.contentStart.type === "AUDIO";
}

/**
 * Check if content is text type
 */
export function isTextContent(event: ContentStartOutputEvent): boolean {
  return event.event.contentStart.type === "TEXT";
}
