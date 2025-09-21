/**
 * Singleton manager for Nova Speech subscribers
 * Ensures only one subscriber per session
 */

import { AudioSubscriber } from './AudioSubscriber';
import { EventMetadata } from '../../events/metadata/EventMetadataProcessor';
import { getPlatformDependencies } from '@gravityai-dev/plugin-base';

const { createLogger } = getPlatformDependencies();
const logger = createLogger('SubscriberManager');

/**
 * Manages all active subscribers
 */
export class SubscriberManager {
  private static instance: SubscriberManager;
  private subscribers = new Map<string, AudioSubscriber>();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): SubscriberManager {
    if (!SubscriberManager.instance) {
      SubscriberManager.instance = new SubscriberManager();
    }
    return SubscriberManager.instance;
  }

  /**
   * Generate unique key for subscriber
   */
  private getKey(chatId: string, nodeId: string, workflowId: string): string {
    return `${chatId}:${nodeId}-${workflowId}`;
  }

  /**
   * Get or create a subscriber for a session
   */
  async getOrCreateSubscriber(
    chatId: string,
    nodeId: string,
    workflowId: string,
    eventQueue: any,
    eventMetadata: EventMetadata,
    promptName: string
  ): Promise<AudioSubscriber> {
    const key = this.getKey(chatId, nodeId, workflowId);

    // Check if subscriber already exists
    const existing = this.subscribers.get(key);
    if (existing) {
      logger.warn('⚠️ Audio subscriber already exists - removing old one', {
        chatId,
        nodeId: `${nodeId}-${workflowId}`,
        key,
        totalSubscribers: this.subscribers.size,
        allKeys: Array.from(this.subscribers.keys()),
      });
      // Stop the old subscriber
      await existing.stop();
      this.subscribers.delete(key);
    }

    // Create new subscriber
    logger.info('🆕 Creating new audio subscriber', {
      chatId,
      nodeId: `${nodeId}-${workflowId}`,
      key,
    });

    const subscriber = new AudioSubscriber(
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
      logger.info('🗑️ Removing audio subscriber', {
        chatId,
        nodeId: `${nodeId}-${workflowId}`,
        key,
      });
      await subscriber.stop();
      this.subscribers.delete(key);
    }
  }

  /**
   * Stop all subscribers (for cleanup)
   */
  async stopAll(): Promise<void> {
    logger.info('🛑 Stopping all audio subscribers', {
      count: this.subscribers.size,
    });

    for (const [key, subscriber] of this.subscribers) {
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
export const subscriberManager = SubscriberManager.getInstance();
