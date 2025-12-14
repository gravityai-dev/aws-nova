/**
 * WebSocket audio subscriber for Nova Speech
 * Manages WebSocket audio sessions and delegates to handlers
 */

import { getPlatformDependencies } from "@gravityai-dev/plugin-base";
import { EventQueue } from "../../core/streaming/EventQueue";
import { EventMetadata } from "../events/metadata/EventMetadataProcessor";
import { WebSocketAudioSession } from "./types";
import { AudioDataHandler, ControlMessageHandler } from "./handlers";

const { createLogger, getAudioWebSocketManager } = getPlatformDependencies();
const logger = createLogger("WebSocketAudioSubscriber");

// Re-export types for backward compatibility
export type { WebSocketAudioSession } from "./types";

/**
 * Manages WebSocket audio subscriptions for Nova Speech sessions
 */
export class WebSocketAudioSubscriber {
  private sessions = new Map<string, WebSocketAudioSession>();
  private static instance: WebSocketAudioSubscriber;

  private constructor() {
    this.setupWebSocketHandlers();
  }

  static getInstance(): WebSocketAudioSubscriber {
    if (!WebSocketAudioSubscriber.instance) {
      WebSocketAudioSubscriber.instance = new WebSocketAudioSubscriber();
    }
    return WebSocketAudioSubscriber.instance;
  }

  private setupWebSocketHandlers(): void {
    const audioWSManager = getAudioWebSocketManager?.();

    if (audioWSManager?.setAudioDataHandler) {
      audioWSManager.setAudioDataHandler(this.handleAudioData.bind(this));
      audioWSManager.setControlMessageHandler(this.handleControlMessage.bind(this));
      logger.info("✅ WebSocket audio subscriber registered");
    } else {
      logger.warn("AudioWebSocketManager not available");
    }
  }

  registerSession(
    wsSessionId: string,
    novaSessionId: string,
    chatId: string,
    eventQueue: EventQueue,
    eventMetadata?: EventMetadata
  ): void {
    this.sessions.set(wsSessionId, {
      sessionId: novaSessionId,
      chatId,
      eventQueue,
      isActive: true,
      eventMetadata: eventMetadata || {
        sessionId: novaSessionId,
        promptName: chatId,
        chatId,
      },
    });

    const audioWSManager = getAudioWebSocketManager?.();
    audioWSManager?.startAudioSession?.(wsSessionId, novaSessionId);

    logger.info("🎧 Session registered", { wsSessionId, novaSessionId, chatId });
  }

  async handleAudioData(sessionId: string, audioData: ArrayBuffer): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      logger.warn("Audio for unregistered session", { sessionId });
      return;
    }

    if (!session.isActive) {
      logger.warn("Audio for inactive session", { sessionId });
      return;
    }

    try {
      await AudioDataHandler.handle(session, audioData);
    } catch (error) {
      logger.error("Failed to handle audio", {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async handleControlMessage(sessionId: string, message: any): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      logger.warn("Control message for unregistered session", { sessionId });
      return;
    }

    await ControlMessageHandler.handle(session, message);
  }

  unregisterSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);

    if (session) {
      session.isActive = false;
      this.sessions.delete(sessionId);
      logger.info("Session unregistered", { sessionId, chatId: session.chatId });
    }
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  getActiveSessions(): string[] {
    return Array.from(this.sessions.entries())
      .filter(([_, session]) => session.isActive)
      .map(([sessionId]) => sessionId);
  }
}
