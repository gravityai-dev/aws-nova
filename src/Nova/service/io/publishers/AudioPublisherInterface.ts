/**
 * Common interface for audio publishers
 */

import { AudioState, StreamingMetadata } from "../../api/types";

export interface AudioPublishConfig {
  audioData: string;
  format: string;
  sourceType: string;
  index: number;
  conversationId: string;
  metadata: StreamingMetadata;
  audioState: AudioState;
  additionalMetadata?: Record<string, any>;
}

export interface StatePublishConfig {
  state: AudioState;
  conversationId: string;
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
   * Check if publisher is available for a conversation
   */
  isAvailable(conversationId: string): boolean;

  /**
   * Clean up any resources for a conversation
   */
  cleanup?(conversationId: string): Promise<void>;
}
