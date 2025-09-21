/**
 * Timing utilities for Nova Speech streaming
 */

export const TIMING_DELAYS = {
  SESSION_START: 50,
  PROMPT_START: 50,
  CONTENT_START: 50,
  CONTENT_END: 100,
  PROMPT_END: 100,
  SESSION_END: 100,
  AUDIO_CHUNK: 32,
  TOOL_RESPONSE: 50,
  AUDIO_CHUNK_BATCH: 100,  // Delay every 5 chunks
  AUDIO_PROCESSING: 500,   // Wait after all chunks sent
  QUEUE_POLL: 10,         // EventQueue polling delay
  STREAM_COMPLETE: 1000,  // Wait for stream completion
} as const;

/**
 * Delays execution for a specified number of milliseconds
 */
export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Waits for a condition to become true
 */
export async function waitForCondition(
  condition: () => boolean,
  pollInterval: number = TIMING_DELAYS.QUEUE_POLL,
  maxWaitTime?: number
): Promise<boolean> {
  const startTime = Date.now();
  
  while (!condition()) {
    if (maxWaitTime && (Date.now() - startTime) > maxWaitTime) {
      return false;
    }
    await delay(pollInterval);
  }
  
  return true;
}
