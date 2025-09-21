/**
 * Stream processor for Nova Speech output
 */

import { getPlatformDependencies } from '@gravityai-dev/plugin-base';
import { NovaSpeechSession } from '../streaming';

const { createLogger } = getPlatformDependencies();

/**
 * Processes output streams from Nova Speech
 */
export class StreamProcessor {
  private logger = createLogger('StreamProcessor');

  /**
   * Processes the output stream from Nova Speech
   */
  async processOutputStream(response: any, session: NovaSpeechSession): Promise<void> {
    if (!response.body) {
      throw new Error("No response body from Nova Speech");
    }

    try {
      for await (const chunk of response.body) {
        if (chunk.chunk?.bytes) {
          const jsonString = new TextDecoder().decode(chunk.chunk.bytes);
          
          try {
            const jsonResponse = JSON.parse(jsonString);
            await session.responseProcessor.processEvent(jsonResponse);
          } catch (parseError) {
            this.logger.error("Failed to parse response chunk", {
              error: parseError,
              chunk: jsonString,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error("Error processing output stream", {
        sessionId: session.sessionId,
        error,
      });
      throw error;
    }
  }
}
