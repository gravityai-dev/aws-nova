/**
 * AWS Nova Speech Service
 * Handles text-to-speech generation using AWS Nova Sonic model
 */

import * as crypto from "crypto";
import { getNodeCredentials } from "../../shared/platform";
import { NovaSpeechConfig, StreamUsageStats as NovaSpeechStats } from "./types";
import { EventQueue } from "./stream/EventQueue";
import { SessionManager } from "./stream/SessionManager";
import { StreamHandler } from "./stream/StreamHandler";
import { createStartEvents } from "./events/in/1_startEvents";
import { createSystemPromptEvents } from "./events/in/2_systemPromptEvents";
import { createConversationHistoryEvents, HistoryMessage } from "./events/in/3_historyEvents";
import { createAudioStreamingEvents } from "./events/in/4_audioStreamingEvents";
import { createPromptEndEvent } from "./events/in/5_promptEndEvent";
import { createSessionEndEvent } from "./events/in/6_sessionEndEvent";
import { createToolStreamingEvents } from "./events/in";
import { addEventMetadata, EventMetadata } from "./events/eventHelpers";
import { delay, TIMING_DELAYS } from "./stream/utils/timing";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { NodeHttp2Handler } from "@smithy/node-http-handler";
import { createLogger } from "../../shared/platform";

export class NovaSpeechService {
  private readonly modelId = "amazon.nova-sonic-v1:0";
  private activeLogger = createLogger("NovaSpeechService");

  /**
   * Generate speech from text using Nova Sonic with Redis streaming
   * Uses SessionOrchestrator for cleaner session lifecycle management
   */
  async generateSpeechStream(
    config: NovaSpeechConfig,
    metadata: any,
    context: any
  ): Promise<NovaSpeechStats> {
    try {
      const credentials = await getNodeCredentials(context, "awsCredential");

      if (!credentials?.accessKeyId || !credentials?.secretAccessKey) {
        throw new Error("AWS credentials not found");
      }

      // Create Bedrock client with HTTP/2 handler
      const http2Handler = new NodeHttp2Handler({
        requestTimeout: 300000,
        sessionTimeout: 300000,
        disableConcurrentStreams: true,
        maxConcurrentStreams: 5,
      });

      const bedrockClient = new BedrockRuntimeClient({
        region: "us-east-1",
        credentials,
        requestHandler: http2Handler,
      });

      // Initialize session components
      const sessionManager = new SessionManager();
      const streamHandler = new StreamHandler(bedrockClient);

      // Create session
      const session = sessionManager.createSession(config, metadata);
      const sessionId = session.sessionId;

      // Use chatId as promptName for request-response pair tracking
      const promptName = metadata.chatId || `prompt-${sessionId}`;

      this.activeLogger.info("🔗 Using IDs for Nova Speech", {
        sessionId,
        promptName,
        chatId: metadata.chatId,
        conversationId: metadata.conversationId,
        userId: metadata.userId,
      });

      // Create event queue and builder
      session.eventQueue = new EventQueue(sessionId);

      // Inference config
      const inferenceConfig = {
        maxTokens: 4096,
        temperature: config.temperature || 0.7,
        topP: config.topP || 0.9,
      };

      // Start streaming - bidirectional stream needs to be open first
      const streamPromise = streamHandler.startStream(session, { modelId: this.modelId }, session.eventQueue);
      //await delay(800);

      // Start processing responses immediately (don't await)
      streamPromise.catch((error) => {
        this.activeLogger.error("Stream error:", error);
        session.eventQueue?.close();
      });

      // Create metadata object for event tracking
      const eventMetadata: EventMetadata = {
        chatId: metadata.chatId,
        conversationId: metadata.conversationId,
        userId: metadata.userId,
        sessionId,
        promptName,
      };

      // Send events with metadata tracking
      const startEvents = createStartEvents(promptName, inferenceConfig, config.voice || "tiffany", true);
      startEvents.forEach((event) => {
        const trackedEvent = addEventMetadata(event, eventMetadata);
        session.eventQueue?.enqueue(trackedEvent);
      });

      const systemEvents = createSystemPromptEvents(promptName, config.systemPrompt || "");
      systemEvents.forEach((event) => {
        const trackedEvent = addEventMetadata(event, eventMetadata);
        session.eventQueue?.enqueue(trackedEvent);
      });

      // Add conversation history if provided
      if (config.conversationHistory && config.conversationHistory.length > 0) {
        const historyMessages: HistoryMessage[] = config.conversationHistory.map((item) => ({
          role: item.role.toUpperCase() as "USER" | "ASSISTANT",
          content: item.content,
        }));

        const historyEvents = createConversationHistoryEvents(promptName, historyMessages, this.activeLogger);
        historyEvents.forEach((event) => {
          const trackedEvent = addEventMetadata(event, eventMetadata);
          session.eventQueue?.enqueue(trackedEvent);
        });
      }

      // Add delay to let Nova initialize the session before sending audio
      await delay(800);

      // Send audio input if provided
      if (config.audioInput && session.eventQueue) {
        const queue = session.eventQueue;
        const audioEvents = createAudioStreamingEvents(promptName, config.audioInput);
        for (const event of audioEvents) {
          const trackedEvent = addEventMetadata(event, eventMetadata);
          queue.enqueue(trackedEvent);
          await delay(100); // Small delay between audio chunks
        }
      }

      // Setup tool response handler - even if toolResponse is empty
      if (config.toolResponse !== undefined && session.responseProcessor) {
        session.responseProcessor.onToolUse = async (toolUse: any) => {
          if (toolUse.toolName === "rag_tool") {
            this.activeLogger.info("🎯 Nova requested RAGtool", {
              sessionId,
              toolUseId: toolUse.toolUseId,
              promptName: toolUse.promptName,
              responseCount: config.toolResponse?.length || 0,
            });

            // Send tool response (even if empty array)
            const toolResultEvents = createToolStreamingEvents(
              toolUse.promptName,
              toolUse.toolUseId,
              config.toolResponse || []
            );
            for (const inputEvent of toolResultEvents) {
              const trackedEvent = addEventMetadata(inputEvent, eventMetadata);
              session.eventQueue!.enqueue(trackedEvent);
              await delay(50);
            }
          }
        };
      }

      // Set up completion handler
      if (session.responseProcessor && session.eventQueue) {
        const queue = session.eventQueue;
        let completionHandled = false;

        session.responseProcessor.onCompletionEnd = () => {
          if (completionHandled) {
            this.activeLogger.info("⚠️ Completion already handled, skipping", { sessionId });
            return;
          }
          completionHandled = true;
          this.activeLogger.info("✅ Received completion signal, closing session", { sessionId });

          // Send close events with metadata and shutdown queue
          const promptEndEvent = addEventMetadata(createPromptEndEvent(promptName), eventMetadata);
          const sessionEndEvent = addEventMetadata(createSessionEndEvent(), eventMetadata);
          queue.enqueue(promptEndEvent);
          queue.enqueue(sessionEndEvent);
          queue.close();
        };
      }

      // Wait for stream to complete
      try {
        await streamPromise;
      } catch (error: any) {
        this.activeLogger.error("Stream processing failed", { error, sessionId });

        // If it's a timeout error, ensure we trigger the completion handler
        if (error.name === "ValidationException" && error.message.includes("Timed out waiting for input events")) {
          this.activeLogger.info("⏱️ Timeout detected - ensuring completion handler is triggered", { sessionId });

          // Trigger completion handler if not already triggered
          if (session.responseProcessor?.onCompletionEnd) {
            session.responseProcessor.onCompletionEnd();
          }
        }

        throw error;
      }

      // Check if we received completion
      if (!session.responseProcessor?.isCompletionReceived()) {
        session.eventQueue?.close();
      }

      // Get results
      const usageStats = session.responseProcessor?.getUsageStats();
      const result = {
        estimated: usageStats?.estimated || false,
        total_tokens: usageStats?.total_tokens || 0,
        chunk_count: usageStats?.chunk_count || 0,
        sessionId,
        textOutput: session.responseProcessor?.getTextOutput() || "",
        audioOutput: usageStats?.audioOutput,
        transcription: usageStats?.transcription || "",
        assistantResponse: usageStats?.assistantResponse || "",
      };

      // Ensure session is properly cleaned up
      sessionManager.endSession(sessionId);

      return {
        estimated: result.estimated || false,
        total_tokens: result.total_tokens || 0,
        chunk_count: result.chunk_count || 0,
        textOutput: result.textOutput || "",
        audioOutput: result.audioOutput,
        sessionId: result.sessionId,
        transcription: result.transcription,
        assistantResponse: result.assistantResponse,
      };
    } catch (error: any) {
      this.activeLogger.error("Failed to generate speech", {
        error: error.message,
        errorName: error.name,
        errorCode: error.code,
        errorStack: error.stack,
        statusCode: error.$metadata?.httpStatusCode,
        requestId: error.$metadata?.requestId,
        config: {
          modelId: this.modelId,
          hasSystemPrompt: !!config.systemPrompt,
          hasAudioInput: !!config.audioInput,
          redisChannel: config.redisChannel,
          voice: config.voice,
        },
        metadata,
      });
      throw error;
    }
  }
}
