/**
 * Nova Session Manager - Singleton Pattern
 * Ensures only one Nova instance per workflow-nodeId combination
 */

import { NovaSpeechConfig, StreamUsageStats as NovaSpeechStats } from "./types";
import { SessionOrchestrator } from "./orchestration/SessionOrchestrator";
import { createLogger } from "./redis/publishAudioChunk";

interface ActiveSession {
  orchestrator: SessionOrchestrator;
  workflowId: string;
  nodeId: string;
  createdAt: number;
  lastActivity: number;
  clientCount: number;
  chatIds: Set<string>;
}

export class NovaSessionManager {
  private static instances = new Map<string, ActiveSession>();
  private static readonly logger = createLogger("NovaSessionManager");
  private static readonly SESSION_TIMEOUT = 300000; // 5 minutes
  private static cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Get or create a Nova session for the given workflow-nodeId
   */
  static async getOrCreateSession(
    workflowId: string, 
    nodeId: string, 
    chatId: string,
    config: NovaSpeechConfig, 
    metadata: any, 
    context: any
  ): Promise<NovaSpeechStats> {
    const key = `${workflowId}-${nodeId}`;
    
    this.logger.info("🔍 Session request", {
      key,
      chatId,
      hasExisting: this.instances.has(key),
      totalSessions: this.instances.size
    });

    let session = this.instances.get(key);

    if (!session) {
      // Create new session
      this.logger.info("🆕 Creating new Nova session", { key, chatId });
      
      const orchestrator = new SessionOrchestrator();
      session = {
        orchestrator,
        workflowId,
        nodeId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        clientCount: 1,
        chatIds: new Set([chatId])
      };
      
      this.instances.set(key, session);
      this.startCleanupTimer();
      
      // Execute the session
      const result = await orchestrator.orchestrateSession(config, metadata, context);
      
      // Update session activity
      session.lastActivity = Date.now();
      
      return result;
    } else {
      // Reuse existing session
      this.logger.info("♻️ Reusing existing Nova session", { 
        key, 
        chatId,
        existingClients: session.clientCount,
        existingChatIds: Array.from(session.chatIds)
      });
      
      // Add this client to the session
      session.chatIds.add(chatId);
      session.clientCount = session.chatIds.size;
      session.lastActivity = Date.now();
      
      // For existing sessions, we need to handle the new client differently
      // This might involve connecting to the existing audio stream
      return this.connectToExistingSession(session, chatId, config, metadata, context);
    }
  }

  /**
   * Connect a new client to an existing Nova session
   */
  private static async connectToExistingSession(
    session: ActiveSession,
    chatId: string,
    config: NovaSpeechConfig,
    metadata: any,
    context: any
  ): Promise<NovaSpeechStats> {
    this.logger.info("🔗 Connecting client to existing session", {
      workflowId: session.workflowId,
      nodeId: session.nodeId,
      chatId,
      totalClients: session.clientCount
    });

    // For now, return a minimal response indicating connection to existing session
    // In a full implementation, this would set up audio routing to the existing session
    return {
      estimated: false,
      total_tokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      chunk_count: 0,
      audioOutput: "",
      textOutput: "Connected to existing session",
      transcription: "",
      assistantResponse: ""
    };
  }

  /**
   * Remove a client from a session
   */
  static removeClient(workflowId: string, nodeId: string, chatId: string): void {
    const key = `${workflowId}-${nodeId}`;
    const session = this.instances.get(key);
    
    if (!session) {
      return;
    }

    session.chatIds.delete(chatId);
    session.clientCount = session.chatIds.size;
    
    this.logger.info("👋 Client removed from session", {
      key,
      chatId,
      remainingClients: session.clientCount
    });

    // If no more clients, mark for cleanup
    if (session.clientCount === 0) {
      this.logger.info("🗑️ Session marked for cleanup (no clients)", { key });
      session.lastActivity = Date.now() - this.SESSION_TIMEOUT; // Force cleanup
    }
  }

  /**
   * Force remove a session
   */
  static removeSession(workflowId: string, nodeId: string): void {
    const key = `${workflowId}-${nodeId}`;
    const session = this.instances.get(key);
    
    if (session) {
      this.logger.info("🛑 Forcefully removing session", { 
        key, 
        clientCount: session.clientCount,
        chatIds: Array.from(session.chatIds)
      });
      
      // TODO: Add cleanup logic for the orchestrator if needed
      // session.orchestrator.cleanup();
      
      this.instances.delete(key);
    }
  }

  /**
   * Get session statistics
   */
  static getSessionStats(): any {
    const stats = {
      totalSessions: this.instances.size,
      sessions: Array.from(this.instances.entries()).map(([key, session]) => ({
        key,
        workflowId: session.workflowId,
        nodeId: session.nodeId,
        clientCount: session.clientCount,
        chatIds: Array.from(session.chatIds),
        createdAt: new Date(session.createdAt).toISOString(),
        lastActivity: new Date(session.lastActivity).toISOString(),
        ageMinutes: Math.round((Date.now() - session.createdAt) / 60000)
      }))
    };

    this.logger.info("📊 Session statistics", stats);
    return stats;
  }

  /**
   * Start cleanup timer for inactive sessions
   */
  private static startCleanupTimer(): void {
    if (this.cleanupInterval) {
      return; // Already running
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000); // Check every minute

    this.logger.info("⏰ Started session cleanup timer");
  }

  /**
   * Cleanup inactive sessions
   */
  private static cleanupInactiveSessions(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [key, session] of this.instances.entries()) {
      const inactiveTime = now - session.lastActivity;
      
      if (inactiveTime > this.SESSION_TIMEOUT) {
        toRemove.push(key);
      }
    }

    for (const key of toRemove) {
      const session = this.instances.get(key)!;
      this.logger.info("🧹 Cleaning up inactive session", {
        key,
        inactiveMinutes: Math.round((now - session.lastActivity) / 60000),
        clientCount: session.clientCount
      });
      
      // TODO: Add proper cleanup
      // session.orchestrator.cleanup();
      
      this.instances.delete(key);
    }

    if (this.instances.size === 0 && this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.info("⏹️ Stopped cleanup timer (no active sessions)");
    }
  }

  /**
   * Shutdown all sessions (for graceful shutdown)
   */
  static shutdown(): void {
    this.logger.info("🛑 Shutting down all Nova sessions", {
      totalSessions: this.instances.size
    });

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // TODO: Add proper cleanup for all sessions
    // for (const [key, session] of this.instances.entries()) {
    //   session.orchestrator.cleanup();
    // }

    this.instances.clear();
  }
}
