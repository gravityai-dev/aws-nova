/**
 * Singleton manager for audio subscribers
 * Ensures only one subscriber per chatId
 */

import { SimpleAudioSubscriber } from "./SimpleAudioSubscriber";
import { EventMetadata } from "../events/eventHelpers";
import { createLogger } from "../redis/publishAudioChunk";

const logger = createLogger("AudioSubscriberManager");

export class AudioSubscriberManager {
  private static instance: AudioSubscriberManager;
  private subscribers = new Map<string, SimpleAudioSubscriber>();

  private constructor() {}

  static getInstance(): AudioSubscriberManager {
    if (!AudioSubscriberManager.instance) {
      AudioSubscriberManager.instance = new AudioSubscriberManager();
    }
    return AudioSubscriberManager.instance;
  }

  /**
   * Generate unique key for subscriber
   */
  private getKey(chatId: string, nodeId: string, workflowId: string): string {
    return `${chatId}:${nodeId}-${workflowId}`;
  }

  /**
   * Get or create a subscriber for a chatId
   */
  async getOrCreateSubscriber(
    chatId: string,
    nodeId: string,
    workflowId: string,
    eventQueue: any,
    eventMetadata: EventMetadata,
    promptName: string
  ): Promise<SimpleAudioSubscriber> {
    const key = this.getKey(chatId, nodeId, workflowId);
    
    // Check if subscriber already exists
    const existing = this.subscribers.get(key);
    if (existing) {
      logger.warn("⚠️ Audio subscriber already exists - removing old one", {
        chatId,
        nodeId: `${nodeId}-${workflowId}`,
        key,
        totalSubscribers: this.subscribers.size,
        allKeys: Array.from(this.subscribers.keys())
      });
      // Stop the old subscriber
      await existing.stop();
      this.subscribers.delete(key);
    }

    // Create new subscriber
    logger.info("🆕 Creating new audio subscriber", {
      chatId,
      nodeId: `${nodeId}-${workflowId}`,
      key
    });

    const subscriber = new SimpleAudioSubscriber(
      chatId,
      nodeId,
      workflowId,
      eventQueue,
      eventMetadata,
      promptName
    );

    await subscriber.start();
    this.subscribers.set(key, subscriber);

    return subscriber;
  }

  /**
   * Stop and remove a subscriber
   */
  async removeSubscriber(chatId: string, nodeId: string, workflowId: string): Promise<void> {
    const key = this.getKey(chatId, nodeId, workflowId);
    const subscriber = this.subscribers.get(key);
    if (subscriber) {
      logger.info("🗑️ Removing audio subscriber", { 
        chatId,
        nodeId: `${nodeId}-${workflowId}`,
        key 
      });
      await subscriber.stop();
      this.subscribers.delete(key);
    }
  }

  /**
   * Stop all subscribers (for cleanup)
   */
  async stopAll(): Promise<void> {
    logger.info("🛑 Stopping all audio subscribers", {
      count: this.subscribers.size
    });

    for (const [chatId, subscriber] of this.subscribers) {
      await subscriber.stop();
    }
    this.subscribers.clear();
  }

  /**
   * Get active subscriber count
   */
  getActiveCount(): number {
    return this.subscribers.size;
  }
}

// Export singleton instance
export const audioSubscriberManager = AudioSubscriberManager.getInstance();
