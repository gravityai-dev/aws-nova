/**
 * Audio stream manager for Nova Speech sessions
 */

import { getPlatformDependencies } from "@gravityai-dev/plugin-base";
import { NovaSpeechConfig, StreamingMetadata } from "../../api/types";
import { NovaSpeechSession } from "../streaming";
import { AudioSubscriber } from "../../io/redis/subscribers";
import { AudioPublisher } from "../../io/redis/publishers";
import { EventMetadataProcessor, EventMetadata } from "../../io/events/metadata/EventMetadataProcessor";
import { AudioEventBuilder, EndEventBuilder, ToolResponseBuilder } from "../../io/events/incoming/builders";
import { TIMING_DELAYS } from "../../utils/timing";

const { createLogger } = getPlatformDependencies();

/**
 * Manages audio streaming for Nova Speech sessions
 */
export class AudioStreamManager {
  private logger = createLogger("AudioStreamManager");

  /**
   * Handles audio streaming setup and control
   */
  async handleAudioStreaming(
    config: NovaSpeechConfig,
    promptName: string,
    sessionId: string,
    metadata: StreamingMetadata,
    session: NovaSpeechSession,
    context?: any
  ): Promise<void> {
    // Check for controlSignal in config (it might be a custom property)
    const controlSignal = (config as any).controlSignal || "START_CALL";

    const eventMetadata: EventMetadata = {
      chatId: metadata.chatId,
      conversationId: metadata.conversationId,
      userId: metadata.userId,
      sessionId,
      promptName,
      workflowId: metadata.workflowId,
      executionId: metadata.executionId,
    };

    // Setup tool response handler if needed
    this.setupToolResponseHandler(config, eventMetadata, session);

    // Setup completion handler
    this.setupCompletionHandler(session, eventMetadata, promptName);

    // Handle control signals
    if (controlSignal === "START_CALL") {
      await this.startAudioStreaming(metadata, session, promptName, eventMetadata, sessionId, context);
    } else if (controlSignal === "END_CALL") {
      await this.endAudioStreaming(session, eventMetadata);
    }
  }

  private async startAudioStreaming(
    metadata: StreamingMetadata,
    session: NovaSpeechSession,
    promptName: string,
    eventMetadata: EventMetadata,
    sessionId: string,
    context?: any
  ): Promise<void> {
    this.logger.info("📞 Starting call - subscribing to audio stream", { 
      sessionId,
      contextKeys: context ? Object.keys(context) : 'no context',
      nodeId: context?.nodeId,
      hasContext: !!context
    });

    // Create audio subscriber with all required parameters
    const nodeId = context?.nodeId || "awsnovaspeech1";
    this.logger.info("Creating AudioSubscriber", {
      nodeId,
      chatId: metadata.chatId,
      workflowId: metadata.workflowId,
      compositeNodeId: `${nodeId}-${metadata.workflowId}`
    });
    
    const audioSubscriber = new AudioSubscriber(
      metadata.chatId || "",
      nodeId,
      metadata.workflowId || sessionId,
      session.eventQueue!,
      eventMetadata,
      promptName
    );

    // Start listening for audio
    await audioSubscriber.start();

    // Store subscriber on session for cleanup
    (session as any).audioSubscriber = audioSubscriber;

    // Publish session ready state with actual nodeId
    const publishNodeId = context?.nodeId || "awsnovaspeech1";
    await AudioPublisher.publishSessionReady(sessionId, metadata, publishNodeId, {
      queueSize: 0,
      maxQueueSize: 50,
    });
  }

  private async endAudioStreaming(session: NovaSpeechSession, eventMetadata: EventMetadata): Promise<void> {
    this.logger.info("📞 Ending call", { sessionId: session.sessionId });

    // Stop audio subscriber if it exists
    const audioSubscriber = (session as any).audioSubscriber;
    if (audioSubscriber && typeof audioSubscriber.stop === "function") {
      await audioSubscriber.stop();
      delete (session as any).audioSubscriber;
    }

    const sessionEndEvent = EndEventBuilder.createSessionEnd();
    const sessionEndWithMetadata = EventMetadataProcessor.addMetadata(sessionEndEvent, eventMetadata);
    session.eventQueue?.enqueue(sessionEndWithMetadata);

    setTimeout(() => {
      session.eventQueue?.close();
    }, TIMING_DELAYS.SESSION_END);
  }

  private setupToolResponseHandler(
    config: NovaSpeechConfig,
    eventMetadata: EventMetadata,
    session: NovaSpeechSession
  ): void {
    // Set up tool handler if we have tools or mcpService
    if (!config.tools && !config.mcpService) return;

    // Cast to the actual implementation type which has setOnToolUse
    const processor = session.responseProcessor as any;
    if (processor.setOnToolUse) {
      processor.setOnToolUse(async (toolUse: any) => {
        this.logger.info("🔧 Tool use detected", {
          toolName: toolUse.toolName,
          toolUseId: toolUse.toolUseId,
          toolInput: toolUse.toolInput,
        });

        try {
          let toolResult: any;
          
          // Check if we have an MCP service function for this tool
          if (config.mcpService && config.mcpService[toolUse.toolName]) {
            this.logger.info("Calling MCP service", { toolName: toolUse.toolName });
            toolResult = await config.mcpService[toolUse.toolName](toolUse.toolInput);
          } else if (config.toolResponse) {
            // Fallback to static tool response if provided
            toolResult = config.toolResponse;
          } else {
            // No handler for this tool
            toolResult = { error: `No handler found for tool: ${toolUse.toolName}` };
          }

          // Build tool response events
          const toolResponseEvents = ToolResponseBuilder.buildToolResponseEvents(
            eventMetadata.promptName,
            toolUse.toolUseId,
            toolResult
          );

          const toolEventsWithMetadata = toolResponseEvents.map((event: any) =>
            EventMetadataProcessor.addMetadata(event, eventMetadata)
          );

          toolEventsWithMetadata.forEach((event: any) => session.eventQueue?.enqueue(event));
        } catch (error) {
          this.logger.error("Error executing tool", { error, toolName: toolUse.toolName });
          
          // Send error response
          const errorResult = { error: `Tool execution failed: ${(error as Error).message}` };
          const toolResponseEvents = ToolResponseBuilder.buildToolResponseEvents(
            eventMetadata.promptName,
            toolUse.toolUseId,
            errorResult
          );

          const toolEventsWithMetadata = toolResponseEvents.map((event: any) =>
            EventMetadataProcessor.addMetadata(event, eventMetadata)
          );

          toolEventsWithMetadata.forEach((event: any) => session.eventQueue?.enqueue(event));
        }
      });
    }
  }

  private setupCompletionHandler(session: NovaSpeechSession, eventMetadata: EventMetadata, promptName: string): void {
    // Cast to the actual implementation type which has onCompletionEnd
    const processor = session.responseProcessor as any;
    if (processor.onCompletionEnd !== undefined) {
      processor.onCompletionEnd = () => {
        this.logger.info("✅ Completion received, sending promptEnd", {
          sessionId: session.sessionId,
          promptName,
        });

        const promptEndEvent = EndEventBuilder.createPromptEnd(promptName);
        const promptEndWithMetadata = EventMetadataProcessor.addMetadata(promptEndEvent, eventMetadata);
        session.eventQueue?.enqueue(promptEndWithMetadata);

        setTimeout(() => {
          if (session.eventQueue?.active) {
            this.logger.info("Closing event queue after completion", {
              sessionId: session.sessionId,
            });
            session.eventQueue.close();
          }
        }, TIMING_DELAYS.PROMPT_END);
      };
    }
  }
}
