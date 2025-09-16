import { EventMetadata, addEventMetadata } from "./eventHelpers";
import { EventQueue } from "../stream/EventQueue";

export class EventMetadataProcessor {
  /**
   * Processes a batch of events by adding metadata and enqueueing them
   * Eliminates the repeated forEach pattern throughout the codebase
   */
  static processEventBatch(
    events: any[], 
    eventMetadata: EventMetadata, 
    eventQueue: EventQueue
  ): void {
    events.forEach((event) => {
      const trackedEvent = addEventMetadata(event, eventMetadata);
      eventQueue.enqueue(trackedEvent);
    });
  }

  /**
   * Processes a batch of events with delays between each event
   * Used for audio events and tool responses that need pacing
   */
  static async processEventBatchWithDelay(
    events: any[], 
    eventMetadata: EventMetadata, 
    eventQueue: EventQueue,
    delayMs: number = 50
  ): Promise<void> {
    for (const event of events) {
      const trackedEvent = addEventMetadata(event, eventMetadata);
      eventQueue.enqueue(trackedEvent);
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  /**
   * Processes a single event with metadata
   */
  static processSingleEvent(
    event: any, 
    eventMetadata: EventMetadata, 
    eventQueue: EventQueue
  ): void {
    const trackedEvent = addEventMetadata(event, eventMetadata);
    eventQueue.enqueue(trackedEvent);
  }
}
