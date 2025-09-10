/**
 * AWS Nova Sonic Usage Events (Output)
 * Based on: https://docs.aws.amazon.com/nova/latest/userguide/output-events.html
 */

export interface UsageEvent {
  event: {
    usageEvent: {
      completionId: string;
      details: {
        delta: {
          input: {
            speechTokens: number;
            textTokens: number;
          };
          output: {
            speechTokens: number;
            textTokens: number;
          };
        };
        total: {
          input: {
            speechTokens: number;
            textTokens: number;
          };
          output: {
            speechTokens: number;
            textTokens: number;
          };
        };
      };
      promptName: string;
      sessionId: string;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalTokens: number;
    };
  };
}

/**
 * Parse usage event from Nova Sonic output
 */
export function parseUsageEvent(data: any): UsageEvent | null {
  if (data?.event?.usageEvent) {
    console.log("📊 [NOVA USAGE EVENT]:", JSON.stringify(data, null, 2));
    return data as UsageEvent;
  }
  return null;
}

/**
 * Check if an event is a usage event
 */
export function isUsageEvent(data: any): data is UsageEvent {
  return !!data?.event?.usageEvent;
}

/**
 * Extract usage statistics from usage event
 */
export function extractUsageStats(event: UsageEvent) {
  return event.event.usageEvent.details;
}

/**
 * Get total tokens from usage event
 */
export function getTotalTokens(event: UsageEvent): number {
  return event.event.usageEvent.totalTokens;
}

/**
 * Get total input tokens from usage event
 */
export function getTotalInputTokens(event: UsageEvent): number {
  return event.event.usageEvent.totalInputTokens;
}

/**
 * Get total output tokens from usage event
 */
export function getTotalOutputTokens(event: UsageEvent): number {
  return event.event.usageEvent.totalOutputTokens;
}

/**
 * Get delta usage from usage event
 */
export function getDeltaUsage(event: UsageEvent) {
  return event.event.usageEvent.details.delta;
}

/**
 * Get total usage from usage event
 */
export function getTotalUsage(event: UsageEvent) {
  return event.event.usageEvent.details.total;
}
