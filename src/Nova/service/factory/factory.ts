/**
 * Factory for creating Nova Speech service instances
 */

import { SessionOrchestrator } from "../core/orchestration";
import { NovaSpeechConfig, StreamUsageStats, StreamingMetadata } from "../api/types";
import { AWSCredentials } from "../io/aws/BedrockClientFactory";

/**
 * Creates a Nova Speech service instance
 */
export function createNovaSpeechService() {
  const orchestrator = new SessionOrchestrator();

  return {
    /**
     * Processes a Nova Speech session
     */
    async processSession(
      config: NovaSpeechConfig,
      metadata: StreamingMetadata,
      credentials: AWSCredentials
    ): Promise<StreamUsageStats> {
      return orchestrator.orchestrateSession(config, metadata, credentials);
    },
  };
}
