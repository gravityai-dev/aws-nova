import { EventQueue } from "./EventQueue";

/**
 * Handles input stream events to Nova Speech
 * Manages the byte stream of events being sent to the service
 */
export class InputStreamHandler {
  /**
   * Creates the event stream from the event queue
   * Events are already logged when created in the events folder
   */
  static createEventStream(eventQueue: EventQueue) {
    // Return the async iterable directly - the SDK expects this format
    return eventQueue.streamEvents();
  }
}
