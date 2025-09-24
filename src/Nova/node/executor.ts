/**
 * AWS Nova Speech Node Executor
 * Handles speech generation using AWS Nova Sonic
 */

import { getPlatformDependencies, type NodeExecutionContext, type ValidationResult } from "@gravityai-dev/plugin-base";
import { AWSNovaSpeechConfig, AWSNovaSpeechInput, AWSNovaSpeechOutput } from "../../util/types";
import type { VoiceOption } from "../service";

const { PromiseNode, saveTokenUsage, getNodeCredentials } = getPlatformDependencies();

export default class NovaSpeechExecutor extends PromiseNode<AWSNovaSpeechConfig> {
  constructor() {
    super("AWSNovaSpeech");
  }

  protected async validateConfig(config: AWSNovaSpeechConfig): Promise<ValidationResult> {
    // Simple validation - let service handle details
    return { success: true };
  }

  /**
   * Execute the AWS Nova Speech node
   */
  protected async executeNode(
    inputs: Record<string, any>,
    config: AWSNovaSpeechConfig,
    context: NodeExecutionContext
  ): Promise<AWSNovaSpeechOutput> {
    const nodeId = context.nodeId;
    const startTime = Date.now();

    this.logger.info(`🚀 [NovaSpeech] Starting execution for node: ${nodeId}`);

    try {
      this.logger.info("Executing AWS Nova Speech node", {
        voice: config.voice,
        temperature: config.temperature,
        workflowId: context.workflow?.id,
      });

      // Get workflow metadata for publishing
      const { chatId, conversationId, userId, providerId } = context.workflow!.variables!;

      this.logger.info("Nova executor input analysis", {
        hasInput: !!inputs.input,
        inputMessage: inputs.input?.message?.substring(0, 50),
        controlSignal: "START_CALL", // Always start call when node executes
        chatId,
      });

      // Build metadata for the service
      const metadata = {
        workflowId: context.workflow!.id,
        executionId: context.executionId,
        chatId,
        conversationId,
        userId,
        providerId: providerId || "AWS Nova Speech",
        workflowRunId: context.executionId,
      };

      // Build credential context for service (service will fetch credentials internally)
      const credentialContext = this.buildCredentialContext(context);

      // Use chatId as the sessionId for streaming
      const streamId = chatId;

      // Log configuration status with VOICE DEBUGGING
      console.log("🎯 [VOICE DEBUG] Nova Speech executor received config:", {
        voice: config.voice,
        voiceType: typeof config.voice,
        temperature: config.temperature,
        temperatureType: typeof config.temperature,
        hasSystemPrompt: !!config.systemPrompt,
        systemPromptPreview: config.systemPrompt ? config.systemPrompt.substring(0, 100) + "..." : "none",
        hasConversationHistory: config.conversationHistory || [],
        historyCount: config.conversationHistory?.length || 0,
      });

      // Dynamically import and create Nova Speech service instance to avoid module-level initialization
      const { NovaSpeechService } = await import("../service");
      const service = new NovaSpeechService();

      // Call the service with all configuration including control signal
      const stats = await service.generateSpeechStream(
        {
          systemPrompt: config.systemPrompt, // Pass system prompt as-is, don't default to empty string
          // Audio input now comes via Redis streaming, not config
          conversationHistory: config.conversationHistory,
          voice: config.voice as VoiceOption,
          redisChannel: config.redisChannel,
          maxTokens: config.maxTokens || 2000,
          temperature: config.temperature || 0.7,
          topP: config.topP || 0.3,
          controlSignal: "START_CALL", // Always start call when node executes
          // Tools should be passed through config if needed, not hardcoded here
        },
        metadata,
        context
      );
      const textOutput = stats.textOutput;
      const transcription = stats.transcription;
      const assistantResponse = stats.assistantResponse;

      this.logger.info("Speech stream completed", {
        streamId,
        workflowId: context.workflow?.id,
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
            workflowId: context.workflow?.id || "",
            executionId: context.executionId,
            nodeId: context.nodeId,
            nodeType: "AWSNovaSpeech",
            model: "amazon.nova-sonic-v1:0",
            inputTokens: stats.inputTokens || 0,
            outputTokens: stats.outputTokens || 0,
            totalTokens: stats.total_tokens,
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

      // Return with completion status following Bedrock pattern
      const finalResult = {
        __outputs: {
          streamId,
          text: textOutput || "",
          conversation: {
            user: transcription || "",
            assistant: assistantResponse || "",
          },
        },
      };

      this.logger.info(
        `🎯 [NovaSpeech] Returning result for node: ${nodeId}, total execution: ${Date.now() - startTime}ms`
      );

      return finalResult;
    } catch (error: any) {
      this.logger.error("Failed to generate speech", {
        error: error.message,
        code: error.name,
        workflowId: context.workflow?.id,
      });

      // Return error output
      return {
        __outputs: {
          streamId: "",
          text: "",
          conversation: {
            user: "",
            assistant: "",
          },
        },
      };
    }
  }

  /**
   * Build credential context from execution context
   */
  private buildCredentialContext(context: NodeExecutionContext) {
    const { workflowId, executionId, nodeId } = this.validateAndGetContext(context);

    return {
      workflowId,
      executionId,
      nodeId,
      nodeType: this.nodeType,
      config: context.config,
      credentials: context.credentials || {},
    };
  }
}

// Export as named export for backward compatibility
export { NovaSpeechExecutor };
