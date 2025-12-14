/**
 * Handles incoming audio data from WebSocket
 */

import { getPlatformDependencies } from "@gravityai-dev/plugin-base";
import { AudioEventBuilder } from "../../events/incoming/builders/AudioEventBuilder";
import { WebSocketAudioSession } from "../types";

const { createLogger } = getPlatformDependencies();
const logger = createLogger("AudioDataHandler");

export class AudioDataHandler {
  /**
   * Process incoming audio data and enqueue Nova events
   */
  static async handle(session: WebSocketAudioSession, audioData: ArrayBuffer): Promise<void> {
    const base64Audio = Buffer.from(audioData).toString("base64");
    const contentName = `${session.chatId}_${Date.now()}`;
    const metadata = session.eventMetadata || {
      sessionId: session.sessionId,
      promptName: session.chatId,
      chatId: session.chatId,
    };

    // 1. Content start
    const contentStartEvent = AudioEventBuilder.createContentStart(session.chatId, contentName);
    session.eventQueue.enqueue({
      ...contentStartEvent,
      _metadata: { ...metadata, timestamp: new Date().toISOString() },
    });

    // 2. Audio input events
    const audioEvents = AudioEventBuilder.createAudioInputEvents(session.chatId, contentName, base64Audio);
    for (const event of audioEvents) {
      session.eventQueue.enqueue({
        ...event,
        _metadata: { ...metadata, timestamp: new Date().toISOString() },
      });
    }

    // 3. Content end
    const contentEndEvent = AudioEventBuilder.createContentEnd(session.chatId, contentName);
    session.eventQueue.enqueue({
      ...contentEndEvent,
      _metadata: { ...metadata, timestamp: new Date().toISOString() },
    });

    logger.debug("🎤 Audio enqueued", {
      sessionId: session.sessionId,
      size: audioData.byteLength,
      eventCount: audioEvents.length + 2,
    });
  }
}
