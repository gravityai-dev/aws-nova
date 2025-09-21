/**
 * Event parser for Nova Speech events
 */

import { getPlatformDependencies } from "@gravityai-dev/plugin-base";
import {
  CompletionHandler,
  ContentHandler,
  ToolUseHandler,
  UsageHandler,
  AudioHandler,
  type CompletionEndEvent,
  type ContentStartOutputEvent,
  type ContentEndOutputEvent,
  type AudioOutputEvent,
  type TextOutputEvent,
  type ToolUseEvent,
  type UsageEvent,
} from "../../io/events/outgoing/handlers";

const { createLogger } = getPlatformDependencies();

export interface ParsedEvent {
  type: string;
  data: any;
  originalEvent: any;
}

export interface CompletionStartEvent {
  event: {
    completionStart: {
      sessionId: string;
      promptName: string;
      completionId: string;
    };
  };
}

/**
 * Parses and validates events from Nova Speech
 */
export class EventParser {
  private readonly logger: any;
  private readonly sessionId: string;

  constructor(sessionId: string, loggerName: string = "EventParser") {
    this.logger = createLogger(loggerName);
    this.sessionId = sessionId;
  }

  /**
   * Parses and validates incoming events from Nova Speech
   */
  parseEvent(jsonResponse: any): ParsedEvent {
    // Determine event type
    const eventType = this.getEventType(jsonResponse);
    const eventData = jsonResponse.event?.[Object.keys(jsonResponse.event || {})[0]];

    if (!eventType || eventType === "unknown") {
      this.logger.warn("Invalid event structure", { jsonResponse });
      throw new Error("Invalid event structure");
    }

    // Log the event
    this.logEvent(eventType, jsonResponse);

    return {
      type: eventType,
      data: eventData,
      originalEvent: jsonResponse,
    };
  }

  /**
   * Determines the event type from the response
   */
  private getEventType(jsonResponse: any): string {
    if (!jsonResponse?.event) return "unknown";

    const eventKeys = Object.keys(jsonResponse.event);
    if (eventKeys.length === 0) return "unknown";

    // Map event keys to types
    const eventKey = eventKeys[0];
    const eventTypeMap: Record<string, string> = {
      completionStart: "completionStart",
      contentStart: "contentStart",
      contentEnd: "contentEnd",
      audioOutput: "audioOutput",
      textOutput: "textOutput",
      completionEnd: "completionEnd",
      usageEvent: "usageEvent",
      toolUse: "toolUse",
      modelStreamErrorException: "modelStreamErrorException",
      internalServerException: "internalServerException",
      validationException: "validationException",
    };

    return eventTypeMap[eventKey] || "unknown";
  }

  /**
   * Logs the event based on its type
   */
  private logEvent(eventType: string, jsonResponse: any): void {
    const loggers: Record<string, string> = {
      completionStart: "🎬 [NOVA COMPLETION START EVENT]",
      contentStart: "🎯 [NOVA CONTENT START EVENT]",
      contentEnd: "🏁 [NOVA CONTENT END EVENT]",
      audioOutput: "🔊 [NOVA AUDIO OUTPUT EVENT]",
      textOutput: "📝 [NOVA TEXT OUTPUT EVENT]",
      completionEnd: "🏁 [NOVA COMPLETION END EVENT]",
      usageEvent: "📊 [NOVA USAGE EVENT]",
      toolUse: "🔧 [NOVA TOOL USE EVENT]",
    };

    const logPrefix = loggers[eventType];
    if (logPrefix) {
      if (eventType === "audioOutput") {
        // For audio output events, don't log the jsonResponse (contains large audio data)
        this.logger.debug(`${logPrefix}`);
      } else {
        // For all other events, log normally with jsonResponse
        // Parse JSON string if needed to ensure proper object formatting
        let logData = jsonResponse;
        if (typeof jsonResponse === 'string') {
          try {
            logData = JSON.parse(jsonResponse);
          } catch (e) {
            // If parsing fails, use original string
            logData = jsonResponse;
          }
        }
        this.logger.debug(logPrefix, logData);
      }
    }
  }

  /**
   * Validates if an event is an error event and throws if so
   */
  validateNotErrorEvent(parsedEvent: ParsedEvent): void {
    const { type, data } = parsedEvent;

    // Handle error events
    if (type === "error") {
      throw new Error(`Nova Speech error: ${data.message || data.Message || "Unknown error"}`);
    }

    if (type === "modelStreamErrorException") {
      this.logger.error("Model stream error", { sessionId: this.sessionId, error: data });
      throw new Error(`Model stream error: ${JSON.stringify(data)}`);
    }

    if (type === "internalServerException") {
      this.logger.error("Internal server error", { sessionId: this.sessionId, error: data });
      throw new Error(`Internal server error: ${JSON.stringify(data)}`);
    }

    if (type === "validationException") {
      this.logger.error("Validation error", { sessionId: this.sessionId, error: data });
      throw new Error(`Validation error: ${JSON.stringify(data)}`);
    }
  }

  /**
   * Type guards for specific event types
   */
  static isCompletionStartEvent(event: any): event is CompletionStartEvent {
    return event.event?.completionStart !== undefined;
  }

  static isContentStartEvent(event: any): event is ContentStartOutputEvent {
    return ContentHandler.isContentStartEvent(event);
  }

  static isContentEndEvent(event: any): event is ContentEndOutputEvent {
    return ContentHandler.isContentEndEvent(event);
  }

  static isAudioOutputEvent(event: any): event is AudioOutputEvent {
    return AudioHandler.isAudioOutputEvent(event);
  }

  static isTextOutputEvent(event: any): event is TextOutputEvent {
    return ContentHandler.isTextOutputEvent(event);
  }

  static isCompletionEndEvent(event: any): event is CompletionEndEvent {
    return CompletionHandler.isCompletionEndEvent(event);
  }

  static isUsageEvent(event: any): event is UsageEvent {
    return UsageHandler.isUsageEvent(event);
  }

  static isToolUseEvent(event: any): event is ToolUseEvent {
    return ToolUseHandler.isToolUseEvent(event);
  }
}
