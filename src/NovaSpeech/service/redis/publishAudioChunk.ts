/**
 * Audio chunk publishing for Nova services
 */
import { getPlatformDependencies } from "@gravityai-dev/plugin-base";
import { v4 as uuid } from "uuid";

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
export { getPlatformDependencies };

// Create shared loggers
export const novaSpeechLogger = createLogger("NovaSpeech");

// Single channel for all events
export const OUTPUT_CHANNEL = "gravity:output";

// Singleton Redis client for audio publishing to avoid connection pool exhaustion
let audioRedisClient: any = null;

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
    id: uuid(),
    timestamp: new Date().toISOString(),
    providerId: config.providerId || "gravity-services",
    chatId: config.chatId,
    conversationId: config.conversationId,
    userId: config.userId,
    __typename: "GravityEvent", // Single type for all events
    type: "GRAVITY_EVENT", // Single type enum
    eventType: config.eventType, // Distinguishes between text, progress, card, etc.
    data: config.data, // Contains the actual event data
  };
}


// Define audio state types - aligned with publishAudioStatus states
export type AudioState = 
  // Session states
  | "AUDIO_SESSION_STARTING"  // Audio session is starting
  | "AUDIO_SESSION_READY"     // Audio session is ready
  | "AUDIO_SESSION_ENDED"     // Audio session has ended
  | "AUDIO_ERROR"             // Audio error occurred
  // Nova speech states
  | "NOVA_SPEECH_STARTED"     // Nova begins speaking
  | "NOVA_SPEECH_STREAMING"   // Nova is streaming audio chunks
  | "NOVA_SPEECH_ENDED"       // Nova finished speaking
  // User speech states
  | "USER_SPEECH_STARTED"     // User begins speaking
  | "USER_SPEECH_STREAMING"   // User is streaming audio
  | "USER_SPEECH_ENDED"       // User finished speaking
  // Special states
  | "AUDIO_SIGNAL"            // Special audio signal/control
  | "SILENCE";                // Silence/no audio

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
  metadata: {
    audioState: AudioState;  // Mandatory audio state in metadata
    [key: string]: any;     // Allow additional metadata
  };
}): Promise<{
  channel: string;
  success: boolean;
}> {
  const logger = createLogger("AudioChunkPublisher");

  try {
    // Create GravityEvent for audio chunk
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
        metadata: {
          ...config.metadata,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Use the universal gravityPublish function from platform API
    const platformDeps = getPlatformDependencies();

    // Fire and forget - don't await to avoid hanging
    platformDeps.gravityPublish(OUTPUT_CHANNEL, event).catch((error) => {
      console.error(`[AudioChunkPublisher] gravityPublish failed:`, error);
    });

    return {
      channel: OUTPUT_CHANNEL,
      success: true,
    };
  } catch (error: any) {
    logger.error("Failed to publish audio chunk", {
      error: error.message,
      chatId: config.chatId,
      conversationId: config.conversationId,
    });
    throw error;
  }
}
