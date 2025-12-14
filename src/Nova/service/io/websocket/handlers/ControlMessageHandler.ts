/**
 * Handles control messages from WebSocket
 */

import { getPlatformDependencies } from "@gravityai-dev/plugin-base";
import { EndEventBuilder } from "../../events/incoming/builders/EndEventBuilder";
import { TIMING_DELAYS } from "../../../utils/timing";
import { WebSocketAudioSession, ControlMessage } from "../types";

const { createLogger } = getPlatformDependencies();
const logger = createLogger("ControlMessageHandler");

export class ControlMessageHandler {
  /**
   * Handle control message and dispatch to appropriate handler
   */
  static async handle(session: WebSocketAudioSession, message: ControlMessage): Promise<void> {
    logger.info("🎮 Control message", {
      sessionId: session.sessionId,
      type: message.type,
      chatId: session.chatId,
    });

    switch (message.type) {
      case "start":
        this.handleStart(session);
        break;
      case "stop":
        await this.handleStop(session);
        break;
      case "end":
        await this.handleEnd(session);
        break;
      default:
        logger.warn("Unknown control message type", { type: message.type });
    }
  }

  private static handleStart(session: WebSocketAudioSession): void {
    session.isActive = true;
    logger.info("Session started", { sessionId: session.sessionId });
  }

  private static async handleStop(session: WebSocketAudioSession): Promise<void> {
    try {
      // 1. Send promptEnd to close the current prompt
      const promptEndEvent = EndEventBuilder.createPromptEnd(session.chatId);
      await session.eventQueue.enqueue(promptEndEvent);
      logger.info("Prompt end sent", { sessionId: session.sessionId, promptName: session.chatId });

      // 2. Send sessionEnd to close the session
      const sessionEndEvent = EndEventBuilder.createSessionEnd();
      await session.eventQueue.enqueue(sessionEndEvent);
      logger.info("Session end sent", { sessionId: session.sessionId });

      // 3. Close queue after delay
      setTimeout(() => {
        session.eventQueue.close();
        logger.info("Queue closed", { sessionId: session.sessionId });
      }, TIMING_DELAYS.SESSION_END || 100);
    } catch (error) {
      logger.warn("Failed to send end events", {
        sessionId: session.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      session.eventQueue.close();
    }

    session.isActive = false;
    logger.info("Session stopped", { sessionId: session.sessionId });
  }

  private static async handleEnd(session: WebSocketAudioSession): Promise<void> {
    try {
      const endEvent = {
        event: {
          contentEnd: {
            promptName: session.chatId,
            contentName: `${session.chatId}_${Date.now()}`,
          },
        },
      };
      await session.eventQueue.enqueue(endEvent);
      logger.info("End of audio sent", { sessionId: session.sessionId });
    } catch (error) {
      logger.error("Failed to send end of audio", {
        sessionId: session.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
