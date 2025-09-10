/**
 * Helper functions for Nova Speech events with enhanced ID tracking
 */

export interface EventMetadata {
  chatId?: string;
  conversationId?: string;
  userId?: string;
  sessionId: string;
  promptName: string;
}

/**
 * Add metadata to any Nova Speech event for better tracking
 */
export function addEventMetadata(event: any, metadata: EventMetadata): any {
  // Add custom metadata field to track IDs across the system
  return {
    ...event,
    _metadata: {
      chatId: metadata.chatId,
      conversationId: metadata.conversationId,
      userId: metadata.userId,
      sessionId: metadata.sessionId,
      promptName: metadata.promptName,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Extract metadata from an event
 */
export function extractEventMetadata(event: any): EventMetadata | null {
  return event._metadata || null;
}
