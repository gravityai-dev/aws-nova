/**
 * AWS Nova Sonic Output Event Types and Parsers
 * Exports all output event types and parsing functions
 */

// Content events
export * from "./contentEvents";

// Usage events
export * from "./usageEvents";

// Start event
export * from "./startEvent";

// Completion end event
export * from "./completionEndEvent";

// Re-export commonly used types for convenience
export type { CompletionStartEvent } from "./startEvent";

export type { ContentStartOutputEvent, ContentEndOutputEvent, AudioOutputEvent } from "./contentEvents";

export type { UsageEvent } from "./usageEvents";

export type { CompletionEndEvent } from "./completionEndEvent";

/**
 * Parse any Nova Sonic output event
 */
export function parseOutputEvent(data: any) {
  const eventType = Object.keys(data?.event || {})[0];
  const eventData = data?.event?.[eventType];

  // Log all incoming events for debugging
  const logData = JSON.parse(JSON.stringify(data)); // Deep copy to avoid modifying original
  if (logData?.event?.audioOutput?.content) {
    const contentLength = logData.event.audioOutput.content.length;
    logData.event.audioOutput.content = `[${contentLength} chars of base64 audio data]`;
  }
  //console.log(`📥 [NOVA OUTPUT EVENT] ${eventType}:`, JSON.stringify(logData, null, 2));

  // Try to parse each event type
  if (data?.event?.completionStart) {
    return { type: "completionStart", event: data };
  }
  if (data?.event?.contentStart) {
    return { type: "contentStart", event: data };
  }
  if (data?.event?.contentEnd) {
    return { type: "contentEnd", event: data };
  }
  if (data?.event?.audioOutput) {
    return { type: "audioOutput", event: data };
  }
  if (data?.event?.textOutput) {
    return { type: "textOutput", event: data };
  }
  if (data?.event?.usageEvent) {
    return { type: "usageEvent", event: data };
  }
  if (data?.event?.completionEnd) {
    return { type: "completionEnd", event: data };
  }
  if (data?.event?.toolUse) {
    return { type: "toolUse", event: data };
  }

  return { type: "unknown", event: data };
}
