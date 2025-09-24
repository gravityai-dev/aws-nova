/**
 * WebSocket audio subscriber for Nova Speech
 * Handles incoming audio from WebSocket connections
 */

import { getPlatformDependencies } from "@gravityai-dev/plugin-base";
import { EventQueue } from "../../core/streaming/EventQueue";
import { AudioEventBuilder } from "../events/incoming/builders/AudioEventBuilder";
import { EventMetadata } from "../events/metadata/EventMetadataProcessor";

const { createLogger, getAudioWebSocketManager } = getPlatformDependencies();
const logger = createLogger("WebSocketAudioSubscriber");

export interface WebSocketAudioSession {
  sessionId: string;      // Nova session ID
  chatId: string;         // Chat ID for this request
  eventQueue: EventQueue; // Nova's event queue
  isActive: boolean;
  contentName?: string;   // Current content name for audio stream
  contentStarted?: boolean; // Whether contentStart has been sent
  eventMetadata?: EventMetadata; // Event metadata for this session
}

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

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    // Get the audio WebSocket manager from platform dependencies
    const audioWSManager = getAudioWebSocketManager?.();

    if (audioWSManager && audioWSManager.setAudioDataHandler) {
      // Register our handlers with the manager
      audioWSManager.setAudioDataHandler(this.handleAudioData.bind(this));
      audioWSManager.setControlMessageHandler(this.handleControlMessage.bind(this));
      logger.info("✅ WebSocket audio subscriber registered with AudioWebSocketManager");
    } else {
      logger.warn("AudioWebSocketManager not available or invalid");
    }
  }

  /**
   * Register a session for WebSocket audio
   * @param wsSessionId - The WebSocket session ID (e.g., conversationId)
   * @param novaSessionId - The Nova session ID
   * @param chatId - The chat ID for this request
   * @param eventQueue - The Nova event queue
   * @param eventMetadata - The event metadata for this session
   */
  registerSession(
    wsSessionId: string, 
    novaSessionId: string, 
    chatId: string, 
    eventQueue: EventQueue,
    eventMetadata?: EventMetadata
  ): void {
    if (this.sessions.has(wsSessionId)) {
      logger.warn("Session already registered, updating", { wsSessionId, novaSessionId, chatId });
    }

    this.sessions.set(wsSessionId, {
      sessionId: novaSessionId,  // Store Nova session ID
      chatId,
      eventQueue,
      isActive: true,
      eventMetadata: eventMetadata || {
        sessionId: novaSessionId,
        promptName: chatId,
        chatId: chatId,
      },
    });

    logger.info("🎧 WebSocket audio session registered", { 
      wsSessionId, 
      novaSessionId, 
      chatId 
    });
  }

  /**
   * Handle incoming audio data from WebSocket
   */
  async handleAudioData(sessionId: string, audioData: ArrayBuffer): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      logger.warn("Received audio for unregistered session", { sessionId });
      return;
    }

    if (!session.isActive) {
      logger.warn("Received audio for inactive session", { sessionId });
      return;
    }

    try {
      // Convert ArrayBuffer to base64 for Nova
      const base64Audio = Buffer.from(audioData).toString("base64");

      // Generate unique content name for this audio segment
      const contentName = `${session.chatId}_${Date.now()}`;

      // Use AudioEventBuilder to create proper Nova events
      const metadata = session.eventMetadata || {
        sessionId: session.sessionId,
        promptName: session.chatId,
        chatId: session.chatId,
      };

      // 1. Content start
      const contentStartEvent = AudioEventBuilder.createContentStart(session.chatId, contentName);
      const contentStartWithMetadata = {
        ...contentStartEvent,
        _metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      };
      session.eventQueue.enqueue(contentStartWithMetadata);

      // 2. Audio input events (AudioEventBuilder handles chunking)
      const audioEvents = AudioEventBuilder.createAudioInputEvents(session.chatId, contentName, base64Audio);
      for (const event of audioEvents) {
        const eventWithMetadata = {
          ...event,
          _metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
          },
        };
        session.eventQueue.enqueue(eventWithMetadata);
      }

      // 3. Content end
      const contentEndEvent = AudioEventBuilder.createContentEnd(session.chatId, contentName);
      const contentEndWithMetadata = {
        ...contentEndEvent,
        _metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      };
      session.eventQueue.enqueue(contentEndWithMetadata);

      logger.debug("🎤 WebSocket audio enqueued", {
        sessionId,
        size: audioData.byteLength,
        chatId: session.chatId,
        eventCount: audioEvents.length + 2, // audio events + start + end
      });
    } catch (error) {
      logger.error("Failed to handle WebSocket audio", {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle control messages from WebSocket
   */
  async handleControlMessage(sessionId: string, message: any): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      logger.warn("Received control message for unregistered session", { sessionId });
      return;
    }

    logger.info("🎮 WebSocket control message", {
      sessionId,
      type: message.type,
      chatId: session.chatId,
    });

    switch (message.type) {
      case "start":
        session.isActive = true;
        logger.info("WebSocket audio session started", { sessionId });
        break;

      case "stop":
        session.isActive = false;
        logger.info("WebSocket audio session stopped", { sessionId });
        break;

      case "end":
        // Send end of audio signal to Nova
        await this.sendEndOfAudio(session);
        break;

      default:
        logger.warn("Unknown control message type", {
          sessionId,
          type: message.type,
        });
    }
  }

  /**
   * Send end of audio signal
   */
  private async sendEndOfAudio(session: WebSocketAudioSession): Promise<void> {
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
      logger.info("End of audio signal sent", { sessionId: session.sessionId });
    } catch (error) {
      logger.error("Failed to send end of audio", {
        sessionId: session.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Unregister a session
   */
  unregisterSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);

    if (session) {
      session.isActive = false;
      this.sessions.delete(sessionId);
      logger.info("WebSocket audio session unregistered", {
        sessionId,
        chatId: session.chatId,
      });
    }
  }

  /**
   * Check if a session is registered
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.entries())
      .filter(([_, session]) => session.isActive)
      .map(([sessionId, _]) => sessionId);
  }
}
