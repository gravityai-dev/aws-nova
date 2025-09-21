/**
 * Event metadata processing for Nova Speech
 */

/**
 * Event metadata structure
 */
export interface EventMetadata {
  chatId?: string;
  conversationId?: string;
  userId?: string;
  sessionId: string;
  promptName: string;
  workflowId?: string;
  executionId?: string;
  timestamp?: string;
}

/**
 * Processes and enriches event metadata
 */
export class EventMetadataProcessor {
  /**
   * Add metadata to an event
   */
  static addMetadata(event: any, metadata: EventMetadata): any {
    return {
      ...event,
      _metadata: {
        ...metadata,
        timestamp: metadata.timestamp || new Date().toISOString(),
      },
    };
  }

  /**
   * Add metadata to multiple events
   */
  static addMetadataToEvents(events: any[], metadata: EventMetadata): any[] {
    return events.map(event => this.addMetadata(event, metadata));
  }

  /**
   * Add metadata to a single event (alias for addMetadata)
   */
  static addMetadataToEvent(event: any, metadata: EventMetadata): any {
    return this.addMetadata(event, metadata);
  }

  /**
   * Extract metadata from an event
   */
  static extractMetadata(event: any): EventMetadata | null {
    return event._metadata || null;
  }

  /**
   * Create metadata from streaming context
   */
  static createFromStreamingContext(
    sessionId: string,
    promptName: string,
    streamingMetadata?: {
      chatId?: string;
      conversationId?: string;
      userId?: string;
      workflowId?: string;
      executionId?: string;
    }
  ): EventMetadata {
    return {
      sessionId,
      promptName,
      chatId: streamingMetadata?.chatId,
      conversationId: streamingMetadata?.conversationId,
      userId: streamingMetadata?.userId,
      workflowId: streamingMetadata?.workflowId,
      executionId: streamingMetadata?.executionId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Merge metadata objects
   */
  static merge(base: EventMetadata, additional: Partial<EventMetadata>): EventMetadata {
    return {
      ...base,
      ...additional,
      timestamp: additional.timestamp || base.timestamp || new Date().toISOString(),
    };
  }
}
