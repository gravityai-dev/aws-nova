/**
 * Session manager for Nova Speech streaming sessions
 */

import { randomUUID } from "crypto";
import { getPlatformDependencies } from "@gravityai-dev/plugin-base";
import { EventQueue } from "./EventQueue";
import { NovaSpeechConfig, StreamingMetadata } from "../../api/types";
import { StreamResponseProcessor } from "../processing/ResponseProcessor";

const { createLogger } = getPlatformDependencies();
const logger = createLogger("SessionManager");

export interface ResponseProcessor {
  processResponse(response: any): Promise<void>;
  getUsageStats(): any;
  cleanup(): void;
}

export interface NovaSpeechSession {
  sessionId: string;
  promptId: string;
  isActive: boolean;
  responseProcessor: StreamResponseProcessor;
  eventQueue?: EventQueue;
  streamProcessingComplete?: Promise<void>;
  // Audio streaming state
  audioContentId: string | null;
  audioContentStartSent: boolean;
  audioChunkCount?: number;
  // Prompt state
  promptStartSent: boolean;
  voiceId?: string;
}

/**
 * Manages Nova Speech streaming sessions
 */
export class SessionManager {
  private sessions = new Map<string, NovaSpeechSession>();

  /**
   * Creates a new session
   */
  createSession(
    streamConfig: NovaSpeechConfig,
    metadata: StreamingMetadata,
    responseProcessor: StreamResponseProcessor
  ): NovaSpeechSession {
    // Use workflowId as sessionId for easier matching between client and Nova
    const sessionId = metadata.workflowId || randomUUID();
    const promptId = randomUUID();

    const session: NovaSpeechSession = {
      sessionId,
      promptId,
      isActive: true,
      responseProcessor,
      audioContentId: null,
      audioContentStartSent: false,
      promptStartSent: false,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Gets a session by ID
   */
  getSession(sessionId: string): NovaSpeechSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Ends a session
   */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      if (session.responseProcessor) {
        session.responseProcessor.cleanup();
      }
      this.sessions.delete(sessionId);
      logger.info("Session ended", { sessionId });
    }
  }

  /**
   * Deletes a session
   */
  deleteSession(sessionId: string): void {
    this.endSession(sessionId);
  }

  /**
   * Sets the stream processing complete promise
   */
  setStreamProcessingComplete(sessionId: string, promise: Promise<void>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.streamProcessingComplete = promise;
    }
  }

  /**
   * Marks a session as inactive
   */
  markSessionInactive(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
    }
  }

  /**
   * Gets all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.entries())
      .filter(([_, session]) => session.isActive)
      .map(([sessionId, _]) => sessionId);
  }

  /**
   * Cleans up all sessions
   */
  cleanup(): void {
    for (const sessionId of this.sessions.keys()) {
      this.endSession(sessionId);
    }
  }
}
