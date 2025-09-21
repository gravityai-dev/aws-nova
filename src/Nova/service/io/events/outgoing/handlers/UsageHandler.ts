/**
 * Usage event handler for Nova Speech
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
 * Handles usage events from Nova Speech
 */
export class UsageHandler {
  /**
   * Parse usage event from Nova Speech output
   */
  static parseUsageEvent(data: any): UsageEvent | null {
    if (data?.event?.usageEvent) {
      console.log("📊 [NOVA USAGE EVENT]:", JSON.stringify(data, null, 2));
      return data as UsageEvent;
    }
    return null;
  }

  /**
   * Check if an event is a usage event
   */
  static isUsageEvent(data: any): data is UsageEvent {
    return !!data?.event?.usageEvent;
  }

  /**
   * Extract usage statistics from usage event
   */
  static extractUsageStats(event: UsageEvent) {
    return event.event.usageEvent.details;
  }

  /**
   * Get total tokens from usage event
   */
  static getTotalTokens(event: UsageEvent): number {
    return event.event.usageEvent.totalTokens;
  }

  /**
   * Get total input tokens from usage event
   */
  static getTotalInputTokens(event: UsageEvent): number {
    return event.event.usageEvent.totalInputTokens;
  }

  /**
   * Get total output tokens from usage event
   */
  static getTotalOutputTokens(event: UsageEvent): number {
    return event.event.usageEvent.totalOutputTokens;
  }

  /**
   * Get delta usage from usage event
   */
  static getDeltaUsage(event: UsageEvent) {
    return event.event.usageEvent.details.delta;
  }

  /**
   * Get total usage from usage event
   */
  static getTotalUsage(event: UsageEvent) {
    return event.event.usageEvent.details.total;
  }

  /**
   * Get speech tokens from usage event
   */
  static getSpeechTokens(event: UsageEvent) {
    return {
      input: event.event.usageEvent.details.total.input.speechTokens,
      output: event.event.usageEvent.details.total.output.speechTokens,
      total: event.event.usageEvent.details.total.input.speechTokens + 
             event.event.usageEvent.details.total.output.speechTokens
    };
  }

  /**
   * Get text tokens from usage event
   */
  static getTextTokens(event: UsageEvent) {
    return {
      input: event.event.usageEvent.details.total.input.textTokens,
      output: event.event.usageEvent.details.total.output.textTokens,
      total: event.event.usageEvent.details.total.input.textTokens + 
             event.event.usageEvent.details.total.output.textTokens
    };
  }
}
