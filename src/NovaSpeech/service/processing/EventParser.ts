import type { Logger } from "pino";
import {
  parseOutputEvent,
  UsageEvent,
  CompletionStartEvent,
  ContentStartOutputEvent,
  ContentEndOutputEvent,
  CompletionEndEvent,
  AudioOutputEvent,
  TextOutputEvent,
} from "../events/out";

export interface ParsedEvent {
  type: string;
  data: any;
  originalEvent: any;
}

export class EventParser {
  private readonly logger: Logger;
  private readonly sessionId: string;

  constructor(logger: Logger, sessionId: string) {
    this.logger = logger;
    this.sessionId = sessionId;
  }

  /**
   * Parses and validates incoming events from Nova Speech
   */
  parseEvent(jsonResponse: any): ParsedEvent {
    // Parse the event using the centralized parser (which includes logging)
    const parsed = parseOutputEvent(jsonResponse);
    const eventType = parsed.type;
    const eventData = jsonResponse.event?.[Object.keys(jsonResponse.event || {})[0]];

    if (!eventType || eventType === "unknown") {
      this.logger.warn("Invalid event structure", { jsonResponse });
      throw new Error("Invalid event structure");
    }

    return {
      type: eventType,
      data: eventData,
      originalEvent: jsonResponse
    };
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
  }

  /**
   * Type guards for specific event types
   */
  static isCompletionStartEvent(event: any): event is CompletionStartEvent {
    return event.event?.completionStart !== undefined;
  }

  static isContentStartEvent(event: any): event is ContentStartOutputEvent {
    return event.event?.contentStart !== undefined;
  }

  static isContentEndEvent(event: any): event is ContentEndOutputEvent {
    return event.event?.contentEnd !== undefined;
  }

  static isAudioOutputEvent(event: any): event is AudioOutputEvent {
    return event.event?.audioOutput !== undefined;
  }

  static isTextOutputEvent(event: any): event is TextOutputEvent {
    return event.event?.textOutput !== undefined;
  }

  static isCompletionEndEvent(event: any): event is CompletionEndEvent {
    return event.event?.completionEnd !== undefined;
  }

  static isUsageEvent(event: any): event is UsageEvent {
    return event.event?.usageEvent !== undefined;
  }

  static isToolUseEvent(event: any): boolean {
    return event.event?.toolUse !== undefined;
  }
}
