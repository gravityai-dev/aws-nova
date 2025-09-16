import { NovaSpeechConfig, StreamUsageStats as NovaSpeechStats } from "../types";
import { EventQueue } from "../stream/EventQueue";
import { SessionManager } from "../stream/SessionManager";
import { StreamHandler } from "../stream/StreamHandler";
import { EventMetadataProcessor } from "../events/EventMetadataProcessor";
import { AwsErrorHandler } from "../errors/AwsErrorHandler";
import { createStartEvents } from "../events/in/1_startEvents";
import { createSystemPromptEvents } from "../events/in/2_systemPromptEvents";
import { createConversationHistoryEvents, HistoryMessage } from "../events/in/3_historyEvents";
import { createAudioInputEvents } from "../events/in/4_audioStreamingEvents";
import { createToolStreamingEvents } from "../events/in";
import { EventMetadata } from "../events/eventHelpers";
import { delay } from "../stream/utils/timing";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { NodeHttp2Handler } from "@smithy/node-http-handler";
import { createLogger } from "../redis/publishAudioChunk";
import { getNodeCredentials } from "../redis/publishAudioChunk";
import { SimpleAudioSubscriber } from "../redis/SimpleAudioSubscriber";

export class SessionOrchestrator {
  private readonly modelId = "amazon.nova-sonic-v1:0";
  private readonly logger = createLogger("SessionOrchestrator");

  /**
   * Orchestrates the complete Nova Speech session lifecycle
   */
  async orchestrateSession(config: NovaSpeechConfig, metadata: any, context: any): Promise<NovaSpeechStats> {
    const credentials = await getNodeCredentials(context, "awsCredential");

    if (!credentials?.accessKeyId || !credentials?.secretAccessKey) {
      throw new Error("AWS credentials not found");
    }

    // Create Bedrock client
    const bedrockClient = this.createBedrockClient(credentials);

    // Initialize session components
    const sessionManager = new SessionManager();
    const streamHandler = new StreamHandler(bedrockClient);

    // Create session
    const session = sessionManager.createSession(config, metadata);
    const sessionId = session.sessionId;

    // Use chatId as promptName for request-response pair tracking
    const promptName = metadata.chatId || `prompt-${sessionId}`;

    this.logger.info("🔗 Using IDs for Nova Speech", {
      sessionId,
      promptName,
      chatId: metadata.chatId,
      conversationId: metadata.conversationId,
      userId: metadata.userId,
    });

    // Create event queue
    session.eventQueue = new EventQueue(sessionId);

    // Build inference configuration
    const inferenceConfig = {
      maxTokens: 4096,
      temperature: config.temperature || 0.7,
      topP: config.topP || 0.9,
    };

    // Start streaming
    const streamPromise = streamHandler.startStream(session, { modelId: this.modelId }, session.eventQueue);

    // Handle stream errors gracefully
    streamPromise.catch((error) => {
      // Check if it's a timeout error
      if (AwsErrorHandler.isTimeoutError(error)) {
        this.logger.info("⏱️ Nova timeout - session will continue", { sessionId });
        // Don't close the queue - let the session continue
        return;
      }

      this.logger.error("Stream error:", error);
      session.eventQueue?.close();
    });

    // Create event metadata
    const eventMetadata: EventMetadata = {
      chatId: metadata.chatId,
      conversationId: metadata.conversationId,
      userId: metadata.userId,
      sessionId,
      promptName,
    };

    // Send initial events
    await this.sendInitialEvents(config, promptName, inferenceConfig, eventMetadata, session.eventQueue);

    // Add delay to let Nova initialize
    await delay(800);

    // Process audio input if available
    await this.processAudioInput(config, promptName, eventMetadata, session.eventQueue, sessionId);

    // Handle control signals
    await this.handleControlSignals(config, eventMetadata, sessionId, metadata, context, session, promptName);

    // Setup tool response handler
    this.setupToolResponseHandler(config, eventMetadata, session);

    // Setup completion handler
    this.setupCompletionHandler(session, eventMetadata, promptName);

    // Wait for stream completion
    try {
      await streamPromise;
    } catch (error: any) {
      this.logger.error("Stream processing failed", { error, sessionId });
      AwsErrorHandler.handleServiceTimeout(error, session);
      throw error;
    }

    // Check completion
    if (!session.responseProcessor?.isCompletionReceived()) {
      session.eventQueue?.close();
    }

    // Get final results
    const result = this.buildFinalResults(session, sessionId);

    // Cleanup
    sessionManager.endSession(sessionId);

    return result;
  }

  /**
   * Creates Bedrock client with HTTP/2 handler
   */
  private createBedrockClient(credentials: any): BedrockRuntimeClient {
    const http2Handler = new NodeHttp2Handler({
      requestTimeout: 300000,
      sessionTimeout: 300000,
      disableConcurrentStreams: true,
      maxConcurrentStreams: 5,
    });

    return new BedrockRuntimeClient({
      region: "us-east-1",
      credentials,
      requestHandler: http2Handler,
    });
  }

  /**
   * Sends initial events (start, system prompt, history)
   */
  private async sendInitialEvents(
    config: NovaSpeechConfig,
    promptName: string,
    inferenceConfig: any,
    eventMetadata: EventMetadata,
    eventQueue: EventQueue
  ): Promise<void> {
    // Send start events
    const startEvents = createStartEvents(promptName, inferenceConfig, config.voice || "tiffany", true);
    EventMetadataProcessor.processEventBatch(startEvents, eventMetadata, eventQueue);

    // Send system prompt events
    const systemEvents = createSystemPromptEvents(promptName, config.systemPrompt || "");
    EventMetadataProcessor.processEventBatch(systemEvents, eventMetadata, eventQueue);

    // Add conversation history if provided
    // if (config.conversationHistory && config.conversationHistory.length > 0) {
    //   const historyMessages: HistoryMessage[] = config.conversationHistory.map((item) => ({
    //     role: item.role.toUpperCase() as "USER" | "ASSISTANT",
    //     content: item.content,
    //   }));

    //   const historyEvents = createConversationHistoryEvents(promptName, historyMessages, this.logger);
    //   EventMetadataProcessor.processEventBatch(historyEvents, eventMetadata, eventQueue);
    // }
  }

  /**
   * Processes audio input if available
   */
  private async processAudioInput(
    config: NovaSpeechConfig,
    promptName: string,
    eventMetadata: EventMetadata,
    eventQueue: EventQueue,
    sessionId: string
  ): Promise<void> {
    this.logger.info("🔍 Nova audio configuration check", {
      hasAudioInput: !!config.audioInput,
      audioInputLength: config.audioInput?.length || 0,
      controlSignal: config.controlSignal,
      hasEventQueue: !!eventQueue,
      sessionId,
    });

    if (config.audioInput && eventQueue) {
      this.logger.info("📥 Processing audio input", { sessionId, audioLength: config.audioInput.length });
      const audioEvents = createAudioInputEvents(promptName, promptName, config.audioInput);
      await EventMetadataProcessor.processEventBatchWithDelay(audioEvents, eventMetadata, eventQueue, 100);
    }
  }

  /**
   * Handles control signals for streaming
   */
  private async handleControlSignals(
    config: NovaSpeechConfig,
    eventMetadata: EventMetadata,
    sessionId: string,
    metadata: any,
    context: any,
    session: any,
    promptName: string
  ): Promise<void> {
    if (!config.controlSignal) return;

    this.logger.info("🎵 Processing control signal", {
      sessionId,
      chatId: eventMetadata.chatId,
      controlSignal: config.controlSignal,
    });

    if (config.controlSignal === "START_CALL") {
      // Create audio subscriber for this session
      const audioSubscriber = new SimpleAudioSubscriber(
        eventMetadata.chatId || "",
        context.nodeId || "cantIDnode",
        metadata.workflowId || sessionId,
        session.eventQueue,
        eventMetadata,
        promptName
      );
      
      // Start listening for audio
      await audioSubscriber.start();
      
      // Store subscriber on session for cleanup
      (session as any).audioSubscriber = audioSubscriber;

      // Publish session ready status with nodeId for audio routing
      const { publishAudioStatus } = await import("../redis/publishAudioStatus");
      publishAudioStatus({
        state: "AUDIO_SESSION_READY",
        chatId: eventMetadata.chatId || "",
        conversationId: eventMetadata.conversationId || "",
        userId: eventMetadata.userId || "",
        providerId: "nova-service",
        workflowId: metadata.workflowId || sessionId,
        workflowRunId: metadata.workflowRunId || "",
        metadata: {
          nodeId: context.nodeId || "cantIDnode", // Nova instance ID from execution context
          workflowId: metadata.workflowId || sessionId,
        },
      });

      this.logger.info("📡 Registered session for audio streaming and published AUDIO_SESSION_READY", {
        sessionId,
        chatId: eventMetadata.chatId,
        nodeId: context.nodeId || "cantIDnode",
        workflowId: metadata.workflowId || sessionId,
      });
    } else if (config.controlSignal === "END_CALL") {
      this.logger.info("🛑 Ending audio call and cleaning up session", { sessionId });

      // Stop audio subscriber if it exists
      const audioSubscriber = (session as any).audioSubscriber;
      if (audioSubscriber) {
        await audioSubscriber.stop();
        delete (session as any).audioSubscriber;
      }

      // Publish session ended status
      const { publishAudioStatus } = await import("../redis/publishAudioStatus");
      publishAudioStatus({
        state: "AUDIO_SESSION_ENDED",
        chatId: eventMetadata.chatId || "",
        conversationId: eventMetadata.conversationId || "",
        userId: eventMetadata.userId || "",
        providerId: "nova-service",
        workflowId: metadata.workflowId || sessionId,
        workflowRunId: metadata.workflowRunId || "",
      });
    }
  }

  /**
   * Sets up tool response handler
   */
  private setupToolResponseHandler(config: NovaSpeechConfig, eventMetadata: EventMetadata, session: any): void {
    if (config.toolResponse === undefined || !session.responseProcessor) return;

    session.responseProcessor.onToolUse = async (toolUse: any) => {
      if (toolUse.toolName === "rag_tool") {
        this.logger.info("🎯 Nova requested RAGtool", {
          sessionId: session.sessionId,
          toolUseId: toolUse.toolUseId,
          promptName: toolUse.promptName,
          responseCount: config.toolResponse?.length || 0,
        });

        // Send tool response
        const toolResultEvents = createToolStreamingEvents(
          toolUse.promptName,
          toolUse.toolUseId,
          config.toolResponse || []
        );
        await EventMetadataProcessor.processEventBatchWithDelay(
          toolResultEvents,
          eventMetadata,
          session.eventQueue!,
          50
        );
      }
    };
  }

  /**
   * Sets up completion handler
   */
  private setupCompletionHandler(session: any, eventMetadata: EventMetadata, promptName: string): void {
    if (!session.responseProcessor || !session.eventQueue) return;

    const queue = session.eventQueue;
    let completionHandled = false;

    session.responseProcessor.onCompletionEnd = () => {
      if (completionHandled) {
        this.logger.info("⚠️ Completion already handled, skipping", { sessionId: session.sessionId });
        return;
      }
      completionHandled = true;
      this.logger.info("🔄 Completion received - keeping session open for continued conversation", {
        sessionId: session.sessionId,
      });

      // Don't close the session - let it continue until END_CALL or timeout
      // The session will be closed by handleControlSignal when END_CALL is received
    };
  }

  /**
   * Builds final results from session
   */
  private buildFinalResults(session: any, sessionId: string): NovaSpeechStats {
    const usageStats = session.responseProcessor?.getUsageStats();

    return {
      estimated: usageStats?.estimated || false,
      total_tokens: usageStats?.total_tokens || 0,
      inputTokens: usageStats?.inputTokens || 0,
      outputTokens: usageStats?.outputTokens || 0,
      chunk_count: usageStats?.chunk_count || 0,
      textOutput: session.responseProcessor?.getTextOutput() || "",
      audioOutput: usageStats?.audioOutput,
      transcription: usageStats?.transcription || "",
      assistantResponse: usageStats?.assistantResponse || "",
    };
  }
}
