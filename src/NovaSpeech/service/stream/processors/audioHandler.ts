import { publishAudioChunk } from "../../redis/publishAudioChunk";
import { ProcessorContext, AudioBufferState } from "./types";
import { createLogger } from "../../redis/publishAudioChunk";

const logger = createLogger("AudioHandler");

// Audio buffer configuration
const AUDIO_BUFFER_TARGET_SIZE = 10240; // 10KB chunks
const AUDIO_BUFFER_MAX_DELAY = 100; // 100ms max delay

// Audio buffer state - simple module-level state
const audioState: AudioBufferState = {
  buffer: [],
  size: 0,
  timeout: null,
  generationComplete: false,
};

/**
 * Handle audio content start - send NOVA_SPEECH_STARTED
 */
export function handleAudioStart(context: ProcessorContext): void {
  const { metadata, sessionId } = context;
  
  console.log("🔊 Nova started speaking - publishing NOVA_SPEECH_STARTED state");
  audioState.generationComplete = false;
  
  publishAudioChunk({
    audioData: "", // Empty for state-only
    format: "lpcm",
    sourceType: "NovaSpeech",
    index: 0,
    chatId: metadata.chatId,
    conversationId: metadata.conversationId,
    userId: metadata.userId,
    providerId: metadata.providerId || "nova-speech",
    sessionId,
    metadata: {
      audioState: "NOVA_SPEECH_STARTED",
      workflowId: metadata.workflowId,
      workflowRunId: metadata.executionId,
      message: "Nova has started speaking - microphone should be muted",
    },
  }).catch((error) => {
    logger.error("Failed to publish NOVA_SPEECH_STARTED", { error: error.message });
  });
}

/**
 * Buffer audio chunk and flush when appropriate
 */
export function bufferAudioChunk(audioData: string, context: ProcessorContext): void {
  if (!audioData) return;
  
  const { metadata, sessionId } = context;
  
  // DIRECT STREAMING - No buffering for real-time response
  publishAudioChunk({
    audioData: audioData,
    format: "lpcm",
    sourceType: "NovaSpeech", 
    index: 0,
    chatId: metadata.chatId,
    conversationId: metadata.conversationId,
    userId: metadata.userId,
    providerId: metadata.providerId || "nova-speech",
    sessionId,
    metadata: {
      audioState: "NOVA_SPEECH_STREAMING",
      workflowId: metadata.workflowId,
      workflowRunId: metadata.executionId,
    },
  }).catch((error) => {
    logger.error("Failed to publish audio chunk", {
      error: error.message,
      chatId: metadata.chatId,
    });
  });
}

/**
 * Mark audio generation as complete
 */
export function markAudioGenerationComplete(context: ProcessorContext): void {
  console.log("🔇 Audio content ended - marking audio generation complete");
  audioState.generationComplete = true;
  
  // Send NOVA_SPEECH_ENDED immediately - no delays
  // Client must handle waiting for playback to complete
  console.log("📤 Sending NOVA_SPEECH_ENDED - client should wait for playback to finish");
  sendAudioEnded(context);
}

/**
 * Flush the audio buffer
 */
function flushAudioBuffer(context: ProcessorContext): void {
  if (audioState.buffer.length === 0) return;
  
  const { metadata, sessionId } = context;
  
  // Clear timeout
  if (audioState.timeout) {
    clearTimeout(audioState.timeout);
    audioState.timeout = null;
  }
  
  // Combine all buffered chunks
  const combinedAudio = audioState.buffer.join('');
  const totalSize = audioState.size;
  
  // Reset buffer
  audioState.buffer = [];
  audioState.size = 0;
  
  // Check if this is the last chunk
  const isLastChunk = audioState.generationComplete && audioState.buffer.length === 0;
  
  // Publish the audio chunk
  publishAudioChunk({
    audioData: combinedAudio,
    format: "lpcm",
    sourceType: "NovaSpeech", 
    index: 0,
    chatId: metadata.chatId,
    conversationId: metadata.conversationId,
    userId: metadata.userId,
    providerId: metadata.providerId || "nova-speech",
    sessionId,
    metadata: {
      audioState: "NOVA_SPEECH_STREAMING",
      workflowId: metadata.workflowId,
      workflowRunId: metadata.executionId,
    },
  }).then(() => {
    // Send NOVA_SPEECH_ENDED after the last audio chunk is successfully published
    if (isLastChunk) {
      console.log("📤 Last audio chunk flushed - now sending NOVA_SPEECH_ENDED");
      sendAudioEnded(context);
    }
  }).catch((error) => {
    logger.error("Failed to flush audio buffer", {
      error: error.message,
      chatId: metadata.chatId,
    });
    
    // Still send ended event if this was the last chunk
    if (isLastChunk) {
      sendAudioEnded(context);
    }
  });
}

/**
 * Send NOVA_SPEECH_ENDED event
 */
function sendAudioEnded(context: ProcessorContext): void {
  const { metadata, sessionId } = context;
  
  publishAudioChunk({
    audioData: "", // Empty for state-only
    format: "lpcm",
    sourceType: "NovaSpeech",
    index: 0,
    chatId: metadata.chatId,
    conversationId: metadata.conversationId,
    userId: metadata.userId,
    providerId: metadata.providerId || "nova-speech",
    sessionId,
    metadata: {
      audioState: "NOVA_SPEECH_ENDED",
      workflowId: metadata.workflowId,
      workflowRunId: metadata.executionId,
      message: "Nova has finished speaking - microphone can be unmuted",
    },
  }).catch((error) => {
    logger.error("Failed to publish NOVA_SPEECH_ENDED", { error: error.message });
  });
  
  audioState.generationComplete = false;
}

/**
 * Reset audio handler state
 */
export function resetAudioHandler(): void {
  audioState.buffer = [];
  audioState.size = 0;
  audioState.generationComplete = false;
  if (audioState.timeout) {
    clearTimeout(audioState.timeout);
    audioState.timeout = null;
  }
}
