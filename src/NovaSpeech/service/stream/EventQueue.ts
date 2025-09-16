import { Subject } from "rxjs";
import { take } from "rxjs/operators";
import { firstValueFrom } from "rxjs";
import { delay } from "./utils/timing";

export class EventQueue {
  private queue: any[] = [];
  private queueSignal = new Subject<void>();
  private closeSignal = new Subject<void>();
  private isActive = true;

  constructor(private sessionId: string) {}

  enqueue(event: any): void {
    if (!this.isActive) {
      throw new Error("Cannot enqueue events after queue is closed");
    }

    this.queue.push(event);
    this.queueSignal.next();
  }

  [Symbol.asyncIterator]() {
    return this.streamEvents();
  }

  async *streamEvents() {
    while (this.isActive || this.queue.length > 0) {
      // Wait for events if queue is empty
      if (this.queue.length === 0 && this.isActive) {
        try {
          await Promise.race([
            firstValueFrom(this.queueSignal.pipe(take(1))),
            firstValueFrom(this.closeSignal.pipe(take(1))).then(() => {
              throw new Error("Stream closed");
            }),
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
  }

  async waitForEmpty(): Promise<void> {
    while (this.queue.length > 0) {
      await delay(10);
    }
  }

  close(): void {
    this.isActive = false;
    this.closeSignal.next();
    this.closeSignal.complete();
    this.queueSignal.complete();
  }

  get length(): number {
    return this.queue.length;
  }

  get active(): boolean {
    return this.isActive;
  }
}
