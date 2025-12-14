/**
 * Session orchestrator for Nova Speech
 * Coordinates the session lifecycle
 */

import { getPlatformDependencies } from "@gravityai-dev/plugin-base";
import { NovaSpeechConfig, StreamUsageStats, StreamingMetadata } from "../../api/types";
import { EventQueue, SessionManager, StreamHandler } from "../streaming";
import { NovaSpeechResponseProcessor } from "../processing";
import { BedrockClientFactory, AWSCredentials } from "../../io/aws/BedrockClientFactory";
import { EventInitializer } from "./EventInitializer";
import { AudioStreamManager } from "./AudioStreamManager";
import { StreamProcessor } from "./StreamProcessor";
import { delay } from "../../utils/timing";
import { WebSocketAudioSubscriber } from "../../io/websocket/WebSocketAudioSubscriber";

const { createLogger } = getPlatformDependencies();

/**
 * Orchestrates Nova Speech sessions
 */
export class SessionOrchestrator {
  private readonly modelId = "amazon.nova-sonic-v1:0";
  private readonly logger = createLogger("SessionOrchestrator");
  private eventInitializer: EventInitializer;
  private audioStreamManager: AudioStreamManager;
  private streamProcessor: StreamProcessor;

  constructor() {
    this.eventInitializer = new EventInitializer();
    this.audioStreamManager = new AudioStreamManager();
    this.streamProcessor = new StreamProcessor();
  }

  /**
   * Orchestrates a Nova Speech session
   */
  async orchestrateSession(
    config: NovaSpeechConfig,
    metadata: StreamingMetadata,
    context: any,
    emit?: (output: any) => void
  ): Promise<StreamUsageStats> {
    // Check for MCP services and get tools if available
    const platformDeps = getPlatformDependencies();

    if (context && platformDeps.callService) {
      try {
        const mcpSchema = await platformDeps.callService("getSchema", {}, context);

        if (mcpSchema?.methods) {
          this.logger.info(`MCP tools available: ${Object.keys(mcpSchema.methods).length} methods`);

          // Convert MCP schema to Nova tools format
          config.tools = Object.entries(mcpSchema.methods).map(([methodName, methodSchema]: [string, any]) => ({
            toolSpec: {
              name: methodName,
              description: methodSchema.description || `Execute ${methodName} operation`,
              inputSchema: {
                json: JSON.stringify(methodSchema.input || { type: "object", properties: {} }),
              },
            },
          }));

          // Create service functions for each tool
          config.mcpService = {};
          for (const [methodName] of Object.entries(mcpSchema.methods)) {
            config.mcpService[methodName] = async (input: any) => {
              this.logger.info(`Calling MCP method: ${methodName}`, { input });
              return platformDeps.callService(methodName, input, context);
            };
          }
        }
      } catch (error) {
        // No MCP service connected - continue without tools
        this.logger.debug("No MCP service connected", { error: (error as Error).message });
      }
    }

    // Fetch AWS credentials internally
    const { getNodeCredentials } = getPlatformDependencies();
    const credentials = await getNodeCredentials(context, "awsCredential");

    if (!credentials?.accessKeyId || !credentials?.secretAccessKey) {
      throw new Error("AWS credentials not found");
    }

    // Create Bedrock client
    const bedrockClient = BedrockClientFactory.create(credentials, BedrockClientFactory.NOVA_SPEECH_CONFIG);

    // Initialize session
    const sessionManager = new SessionManager();
    const streamHandler = new StreamHandler(bedrockClient);
    const responseProcessor = new NovaSpeechResponseProcessor(
      metadata,
      config,
      metadata.workflowId || "unknown",
      metadata.chatId || "unknown",
      undefined, // loggerName
      emit // Pass the emit function
    );

    const session = sessionManager.createSession(config, metadata, responseProcessor);
    const sessionId = session.sessionId;
    const promptName = metadata.chatId || `prompt-${sessionId}`;

    session.eventQueue = new EventQueue(sessionId);

    // Start streaming
    const streamPromise = streamHandler.startStream(
      session,
      { modelId: this.modelId },
      session.eventQueue,
      (response, session) => this.streamProcessor.processOutputStream(response, session)
    );

    streamPromise.catch(async (error) => {
      this.logger.error("Stream error:", error);

      // Use the AwsErrorHandler to log the error properly
      const { AwsErrorHandler } = await import("../../utils/errors/AwsErrorHandler");
      await AwsErrorHandler.handleStreamError(error, {
        sessionId,
        promptId: promptName,
        responseProcessor: session.responseProcessor
          ? {
              handleError: (err: any) => session.responseProcessor!.handleError(err),
            }
          : undefined,
      });

      // Don't close the event queue for ModelStreamErrorException
      if (error.name !== "ModelStreamErrorException") {
        session.eventQueue?.close();
      }
    });

    // Initialize events
    await this.eventInitializer.sendInitialEvents(config, promptName, sessionId, metadata, session.eventQueue);

    await delay(800);

    // Handle audio streaming with context for nodeId and emit for MCP results
    await this.audioStreamManager.handleAudioStreaming(config, promptName, sessionId, metadata, session, context, emit);

    // Wait for completion
    try {
      await streamPromise;
    } catch (error: any) {
      this.logger.error("Stream processing failed", { error, sessionId });

      // Handle specific AWS errors gracefully
      if (error.name === "ModelStreamErrorException") {
        this.logger.warn("Nova encountered a stream error - completing gracefully", {
          sessionId,
          errorMessage: error.message,
        });

        // Return partial results if available
        const partialResult = session.responseProcessor?.getUsageStats() || {
          estimated: true,
          total_tokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          chunk_count: 0,
          textOutput: "",
          transcription: "",
          assistantResponse: "",
        };

        sessionManager.endSession(sessionId);
        return partialResult;
      }

      // Re-throw other errors
      throw error;
    }

    // Get results
    const result = session.responseProcessor?.getUsageStats() || {
      estimated: true,
      total_tokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      chunk_count: 0,
      textOutput: "",
      transcription: "",
      assistantResponse: "",
    };

    sessionManager.endSession(sessionId);
    return result;
  }
}
