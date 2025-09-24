/**
 * Event queue for Nova Speech streaming
 */

import { Subject } from "rxjs";
import { take } from "rxjs/operators";
import { firstValueFrom } from "rxjs";

/**
 * Manages event queuing and streaming for Nova Speech sessions
 */
export class EventQueue {
  private queue: any[] = [];
  private queueSignal = new Subject<void>();
  private closeSignal = new Subject<void>();
  private isActive = true;

  constructor(private sessionId: string) {}

  /**
   * Adds an event to the queue
   */
  enqueue(event: any): void {
    if (!this.isActive) {
      throw new Error("Cannot enqueue events after queue is closed");
    }

    this.queue.push(event);
    this.queueSignal.next();
  }

  /**
   * Makes the queue iterable for streaming
   */
  [Symbol.asyncIterator]() {
    return this.streamEvents();
  }

  /**
   * Streams events from the queue
   */
  async *streamEvents() {
    try {
      while (this.isActive || this.queue.length > 0) {
        // Wait for events if queue is empty
        if (this.queue.length === 0 && this.isActive) {
          try {
            await Promise.race([
              firstValueFrom(this.queueSignal.pipe(take(1))).catch((error) => {
                // Handle EmptyError when queueSignal completes without emitting
                if (error && error.constructor.name === 'EmptyError') {
                  throw new Error("Stream closed");
                }
                throw error;
              }),
              firstValueFrom(this.closeSignal.pipe(take(1))).catch((error) => {
                // Handle EmptyError when closeSignal completes without emitting
                if (error && error.constructor.name === 'EmptyError') {
                  throw new Error("Stream closed");
                }
                throw error;
              })
            ]);
          } catch (error) {
            if (error instanceof Error && error.message === "Stream closed") {
              break;
            }
            throw error;
          }
        }

        // Process events in queue
        if (this.queue.length > 0) {
          const event = this.queue.shift();
          if (event) {
            // Convert event to JSON and encode as UTF-8 bytes
            const eventJson = JSON.stringify(event);
            const textEncoder = new TextEncoder();
            // Match the exact format from the working example
            yield {
              chunk: {
                bytes: textEncoder.encode(eventJson),
              },
            };

            // No delay between events
          }
        }

        // Only exit if queue is closed (not just empty)
        // We need to keep the stream open even with empty queue to allow for response-triggered events
        if (!this.isActive && this.queue.length === 0) {
          break;
        }
      }
    } catch (error) {
      // Catch any EmptyError that might escape
      if (error && error.constructor.name === 'EmptyError') {
        // Gracefully exit on EmptyError
        return;
      }
      throw error;
    }
  }

  /**
   * Waits for the queue to be empty
   */
  async waitForEmpty(): Promise<void> {
    while (this.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Closes the queue
   */
  close(): void {
    this.isActive = false;
    this.closeSignal.next();
    this.closeSignal.complete();
    this.queueSignal.complete();
  }

  /**
   * Gets the current queue length
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * Checks if the queue is active
   */
  get active(): boolean {
    return this.isActive;
  }
}
