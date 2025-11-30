/**
 * AWS Nova Speech Node Executor
 * Handles speech generation using AWS Nova Sonic
 */

import { getPlatformDependencies } from "@gravityai-dev/plugin-base";
import { AWSNovaSpeechConfig } from "../../util/types";
import type { VoiceOption } from "../service";

const { CallbackNode, saveTokenUsage, createLogger } = getPlatformDependencies();

interface NovaSpeechState {
  isComplete: boolean;
}

export default class NovaSpeechExecutor extends CallbackNode<AWSNovaSpeechConfig, NovaSpeechState> {
  private logger: any;

  constructor() {
    super("AWSNovaSpeech");
    this.logger = createLogger("NovaSpeechExecutor");
  }

  /**
   * Initialize state
   */
  initializeState(inputs: any): NovaSpeechState {
    return {
      isComplete: false,
    };
  }

  /**
   * Handle events
   */
  async handleEvent(
    event: { type: string; inputs?: any; config?: any },
    state: NovaSpeechState,
    emit: (output: any) => void,
    context?: any // NodeExecutionContext from the framework
  ): Promise<NovaSpeechState> {
    // If already complete, return
    if (state.isComplete) {
      return state;
    }

    // Need context to proceed
    if (!context) {
      this.logger.error("No execution context provided");
      return { ...state, isComplete: true };
    }

    const { inputs, config } = event;
    const startTime = Date.now();

    try {
      this.logger.info("Executing AWS Nova Speech node", {
        workflowId: context.workflowId,
        executionId: context.executionId
      });
      
      // Get workflow variables from context
      const { chatId, conversationId, userId, providerId } = context.workflow?.variables || {};
      
      // Build metadata for the service using context (like BedrockClaude)
      const metadata = {
        workflowId: context.workflowId || context.workflow?.id || "",
        executionId: context.executionId,
        nodeId: context.nodeId,
        chatId: chatId || "",
        conversationId: conversationId || "",
        userId: userId || "",
        providerId: providerId || "AWS Nova Speech",
        workflowRunId: context.executionId,
      };

      // Use chatId as the sessionId for streaming
      const streamId = chatId;

      // Log configuration status with VOICE DEBUGGING
      console.log("🎯 [VOICE DEBUG] Nova Speech executor received config:", {
        voice: config.voice,
        voiceType: typeof config.voice,
        temperature: config.temperature,
        temperatureType: typeof config.temperature,
        hasSystemPrompt: !!config.systemPrompt,
        systemPromptPreview: config.systemPrompt
          ? config.systemPrompt.substring(0, 100) + "..."
          : "none",
        hasConversationHistory: config.conversationHistory || [],
        historyCount: config.conversationHistory?.length || 0,
      });

      // Dynamically import and create Nova Speech service instance to avoid module-level initialization
      const { NovaSpeechService } = await import("../service");
      const service = new NovaSpeechService();

      // Call the service with all configuration including control signal
      const stats = await service.generateSpeechStream(
        {
          systemPrompt: config.systemPrompt,
          conversationHistory: config.conversationHistory,
          voice: config.voice as VoiceOption,
          redisChannel: config.redisChannel,
          maxTokens: config.maxTokens || 2000,
          temperature: config.temperature || 0.7,
          topP: config.topP || 0.3,
          controlSignal: "START_CALL",
        },
        metadata,
        context, // Pass the context (same as PromiseNodes!)
        emit // Pass the emit function so TextAccumulator can emit outputs!
      );
      const textOutput = stats.textOutput;
      const transcription = stats.transcription;
      const assistantResponse = stats.assistantResponse;

      this.logger.info("Speech stream completed", {
        streamId,
        chatId: chatId || "",
        textOutput: textOutput ? `${textOutput.substring(0, 100)}...` : "No text output",
        audioOutput: stats.audioOutput ? "Audio generated" : "No audio output",
        totalTokens: stats.total_tokens,
      });

      // Save token usage to database if we have usage data
      if (stats.total_tokens && stats.total_tokens > 0) {
        // Debug log to check what stats contains
        console.log("🔍 [NOVA EXECUTOR DEBUG] Stats:", {
          total_tokens: stats.total_tokens,
          inputTokens: stats.inputTokens,
          outputTokens: stats.outputTokens,
        });

        try {
          await saveTokenUsage({
            workflowId: metadata.workflowId,
            executionId: metadata.executionId,
            nodeId: context.nodeId,
            nodeType: "AWSNovaSpeech",
            model: "amazon.nova-sonic-v1:0",
            usage: {
              inputTokens: stats.inputTokens || 0,
              outputTokens: stats.outputTokens || 0,
              total_tokens: stats.total_tokens,
            },
            timestamp: new Date(),
          });
          this.logger.info(
            `Nova Speech token usage saved: ${stats.total_tokens} tokens (input: ${stats.inputTokens || 0}, output: ${
              stats.outputTokens || 0
            })`
          );
        } catch (error: any) {
          this.logger.error("Failed to save Nova Speech token usage", { error: error.message });
        }
      }

      // Emit the final output
      emit({
        __outputs: {
          text: textOutput || "",
        },
      });

      this.logger.info(`🎯 [NovaSpeech] Completed execution, total time: ${Date.now() - startTime}ms`);

      // Return state marking completion
      return {
        ...state,
        isComplete: true,
      };
    } catch (error: any) {
      this.logger.error("Failed to generate speech", {
        error: error.message,
        code: error.name,
        workflowId: context?.workflowId
      });

      // Return error state
      return {
        ...state,
        isComplete: true,
      };
    }
  }
}

// Export as named export for backward compatibility
export { NovaSpeechExecutor };
