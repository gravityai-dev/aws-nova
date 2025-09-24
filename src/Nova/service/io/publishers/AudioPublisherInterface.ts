/**
 * Common interface for audio publishers
 */

import { AudioState, StreamingMetadata } from "../../api/types";

export interface AudioPublishConfig {
  audioData: string;
  format: string;
  sourceType: string;
  index: number;
  sessionId: string;
  metadata: StreamingMetadata;
  audioState: AudioState;
  additionalMetadata?: Record<string, any>;
}

export interface StatePublishConfig {
  state: AudioState;
  sessionId: string;
  metadata: StreamingMetadata;
  message?: string;
  additionalMetadata?: Record<string, any>;
}

export interface AudioPublisherInterface {
  /**
   * Publish audio data
   */
  publishAudio(config: AudioPublishConfig): Promise<void>;
  
  /**
   * Publish state change (start/stop signals)
   */
  publishState(config: StatePublishConfig): Promise<void>;
  
  /**
   * Check if publisher is available for a session
   */
  isAvailable(sessionId: string): boolean;
  
  /**
   * Clean up any resources for a session
   */
  cleanup?(sessionId: string): Promise<void>;
}
