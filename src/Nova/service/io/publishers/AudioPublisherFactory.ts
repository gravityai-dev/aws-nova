/**
 * Factory for creating appropriate audio publishers
 */

import { AudioPublisherInterface } from "./AudioPublisherInterface";
// RedisAudioPublisher removed - using WebSocket only
import { WebSocketAudioPublisher } from "./WebSocketAudioPublisher";
import { getPlatformDependencies } from "@gravityai-dev/plugin-base";

const { createLogger } = getPlatformDependencies();
const logger = createLogger("AudioPublisherFactory");

export class AudioPublisherFactory {
  private static webSocketPublisher = new WebSocketAudioPublisher();

  /**
   * Get the best publisher for a session
   * Currently only using WebSocket for testing
   */
  static getPublisher(sessionId: string): AudioPublisherInterface {
    // TEMPORARY: Only use WebSocket for now
    //logger.debug("Using WebSocket publisher (Redis disabled for testing)", { sessionId });
    return this.webSocketPublisher;

    // TODO: Re-enable Redis fallback after WebSocket testing
    // // Check if WebSocket is available for this session
    // if (this.webSocketPublisher.isAvailable(sessionId)) {
    //   logger.debug("Using WebSocket publisher", { sessionId });
    //   return this.webSocketPublisher;
    // }

    // // Fall back to Redis
    // logger.debug("Using Redis publisher", { sessionId });
    // return this.redisPublisher;
  }

  /**
   * Get WebSocket publisher
   */
  static getWebSocketPublisher(): AudioPublisherInterface {
    return this.webSocketPublisher;
  }
}
