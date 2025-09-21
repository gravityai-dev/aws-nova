/**
 * Nova Speech Service
 * Main service implementation that wraps the orchestrator
 */

import { SessionOrchestrator } from "./core/orchestration";
import { NovaSpeechConfig, StreamUsageStats, StreamingMetadata } from "./api/types";

export class NovaSpeechService {
  private orchestrator: SessionOrchestrator;

  constructor() {
    this.orchestrator = new SessionOrchestrator();
  }

  /**
   * Generate speech stream using Nova
   */
  async generateSpeechStream(
    config: NovaSpeechConfig,
    metadata: StreamingMetadata,
    context: any
  ): Promise<StreamUsageStats> {
    return this.orchestrator.orchestrateSession(config, metadata, context);
  }
}

// Export factory function for backward compatibility
export { createNovaSpeechService } from "./factory/factory";

// Re-export types for convenience
export type {
  NovaSpeechConfig,
  StreamUsageStats,
  StreamingMetadata,
  AudioState,
  AudioChunk,
  StreamingSession,
  EventMetadata,
  VoiceOption,
} from "./api/types";
