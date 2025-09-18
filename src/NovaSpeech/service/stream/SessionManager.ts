import { randomUUID } from "crypto";
import { NovaSpeechResponseProcessor } from "./processors/ResponseProcessor";
import { EventQueue } from "./EventQueue";
import { createLogger } from "../redis/publishAudioChunk";

const logger = createLogger("SessionManager");
import { NovaSpeechStreamConfig, StreamingMetadata } from "../types";

export interface NovaSpeechSession {
  sessionId: string;
  promptId: string;
  isActive: boolean;
  responseProcessor: NovaSpeechResponseProcessor;
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

export class SessionManager {
  private sessions = new Map<string, NovaSpeechSession>();

  createSession(streamConfig: NovaSpeechStreamConfig, metadata: StreamingMetadata): NovaSpeechSession {
    // Use workflowId as sessionId for easier matching between client and Nova
    const sessionId = metadata.workflowId || randomUUID();
    const promptId = randomUUID();

    const session: NovaSpeechSession = {
      sessionId,
      promptId,
      isActive: true,
      responseProcessor: new NovaSpeechResponseProcessor(metadata, streamConfig, logger as any, sessionId, promptId),
      audioContentId: null,
      audioContentStartSent: false,
      promptStartSent: false,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): NovaSpeechSession | undefined {
    return this.sessions.get(sessionId);
  }

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.sessions.delete(sessionId);
      logger.info("Session ended", { sessionId });
    }
  }

  deleteSession(sessionId: string): void {
    this.endSession(sessionId);
  }

  setStreamProcessingComplete(sessionId: string, promise: Promise<void>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.streamProcessingComplete = promise;
    }
  }

  markSessionInactive(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
    }
  }
}
