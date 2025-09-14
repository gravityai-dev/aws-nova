/**
 * Shared platform dependencies for all Nova services
 */
import { getPlatformDependencies } from "@gravityai-dev/plugin-base";

// Get platform dependencies once
const deps = getPlatformDependencies();

export const getNodeCredentials = deps.getNodeCredentials;
export const saveTokenUsage = deps.saveTokenUsage;
export const createLogger = deps.createLogger;
export const getConfig = deps.getConfig;
export const getRedisClient = deps.getRedisClient;
export const PromiseNode = deps.PromiseNode;
export const CallbackNode = deps.CallbackNode;
export const NodeExecutionContext = deps.NodeExecutionContext;

// Create shared loggers
export const novaSpeechLogger = createLogger("NovaSpeech");

// Single channel for all events
export const OUTPUT_CHANNEL = "gravity:output";

/**
 * Build a unified GravityEvent structure
 */
export function buildOutputEvent(config: {
  eventType: string;
  chatId: string;
  conversationId: string;
  userId: string;
  providerId?: string;
  data: Record<string, any>;
}): Record<string, any> {
  // Ensure required fields
  if (!config.chatId || !config.conversationId || !config.userId) {
    throw new Error("chatId, conversationId, and userId are required");
  }

  // Build unified message structure
  return {
    id: Math.random().toString(36).substring(2, 15),
    timestamp: new Date().toISOString(),
    providerId: config.providerId || "gravity-services",
    chatId: config.chatId,
    conversationId: config.conversationId,
    userId: config.userId,
    __typename: "GravityEvent",  // Single type for all events
    type: "GRAVITY_EVENT",       // Single type enum
    eventType: config.eventType, // Distinguishes between text, progress, card, etc.
    data: config.data            // Contains the actual event data
  };
}

/**
 * Publish an audio chunk event
 */
export async function publishAudioChunk(config: {
  audioData: string;
  format: string;
  sourceType: string;
  index: number;
  chatId: string;
  conversationId: string;
  userId: string;
  providerId: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}): Promise<{
  channel: string;
  success: boolean;
}> {
  const logger = createLogger("AudioChunkPublisher");
  
  try {
    // Build the event structure
    const event = buildOutputEvent({
      eventType: "audioChunk",
      chatId: config.chatId,
      conversationId: config.conversationId,
      userId: config.userId,
      providerId: config.providerId,
      data: {
        audioData: config.audioData,
        format: config.format,
        sourceType: config.sourceType,
        index: config.index,
        sessionId: config.sessionId,
        metadata: config.metadata,
      },
    });

    // Get Redis client from platform - call it fresh each time
    const deps = getPlatformDependencies();
    const redis = deps.getRedisClient();

    // Publish to Redis Streams (not Pub/Sub) for reliable delivery
    const REDIS_NAMESPACE = process.env.REDIS_NAMESPACE || process.env.NODE_ENV || "local";
    const streamKey = `${REDIS_NAMESPACE}:workflow:events:stream`;
    const conversationId = config.conversationId || "";

    await redis.xadd(
      streamKey,
      "*",
      "conversationId",
      conversationId,
      "channel",
      OUTPUT_CHANNEL,
      "message",
      JSON.stringify(event)
    );

    logger.info("AudioChunk published as GravityEvent", {
      eventType: "audioChunk",
      channel: OUTPUT_CHANNEL,
      index: config.index,
      format: config.format,
      providerId: config.providerId,
    });

    return {
      channel: OUTPUT_CHANNEL,
      success: true,
    };
  } catch (error: any) {
    logger.error("Failed to publish audio chunk", {
      error: error.message,
      providerId: config.providerId,
    });
    throw error;
  }
}
