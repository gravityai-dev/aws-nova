/**
 * AWS Nova Speech Node Executor
 * Handles speech generation using AWS Nova Sonic
 */

import { getPlatformDependencies, type NodeExecutionContext } from "@gravityai-dev/plugin-base";
import { AWSNovaSpeechConfig, AWSNovaSpeechInput, AWSNovaSpeechOutput } from "../../util/types";
import { NovaSpeechService } from "../service";

// Get platform dependencies using Pattern A (correct pattern)
const { PromiseNode, createLogger, saveTokenUsage } = getPlatformDependencies();

export class NovaSpeechExecutor extends PromiseNode<AWSNovaSpeechConfig> {
  constructor() {
    super("AWSNovaSpeech");
  }

  /**
   * Execute the AWS Nova Speech node
   */
  protected async executeNode(
    inputs: AWSNovaSpeechInput,
    config: AWSNovaSpeechConfig,
    context: NodeExecutionContext
  ): Promise<AWSNovaSpeechOutput> {
    const logger = createLogger("NovaSpeech");
    try {
      logger.info("Executing AWS Nova Speech node", {
        voice: config.voice,
        temperature: config.temperature,
        workflowId: context.workflow?.id,
      });

      // Get workflow metadata for publishing
      const { chatId, conversationId, userId, providerId } = context.workflow!.variables!;

      logger.info("Nova executor input analysis", {
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

      // Build credential context for service
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

      // Create Nova Speech service instance
      const service = new NovaSpeechService();

      // Call the service with all configuration including control signal
      const stats = await service.generateSpeechStream(
        {
          systemPrompt: config.systemPrompt, // Pass system prompt as-is, don't default to empty string
          // Audio input now comes via Redis streaming, not config
          conversationHistory: config.conversationHistory,
          toolResponse: config.toolResponse && config.toolResponse.length > 0 ? config.toolResponse : undefined,
          voice: config.voice,
          redisChannel: config.redisChannel,
          modelId: "amazon.nova-sonic-v1:0",
          maxTokens: config.maxTokens || 4096,
          temperature: config.temperature || 0.7,
          topP: config.topP || 0.9,
          controlSignal: "START_CALL", // Always start call when node executes
        },
        metadata,
        credentialContext
      );
      const textOutput = stats.textOutput;
      const transcription = stats.transcription;
      const assistantResponse = stats.assistantResponse;

      logger.info("Speech stream completed", {
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
          logger.info(
            `Nova Speech token usage saved: ${stats.total_tokens} tokens (input: ${stats.inputTokens || 0}, output: ${
              stats.outputTokens || 0
            })`
          );
        } catch (error: any) {
          logger.error("Failed to save Nova Speech token usage", { error: error.message });
        }
      }

      // Return with completion status
      return {
        __outputs: {
          streamId,
          text: textOutput || "",
          conversation: {
            user: transcription || "",
            assistant: assistantResponse || "",
          },
        },
      };
    } catch (error: any) {
      logger.error("Failed to generate speech", {
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
    return {
      credentials: {
        awsCredential: context.credentials?.awsCredential || {},
      },
      nodeType: "AWSNovaSpeech",
      workflowId: context.workflow?.id || "",
      executionId: context.executionId || "",
      nodeId: context.nodeId || "",
    };
  }
}

// Export as default for backward compatibility
export default NovaSpeechExecutor;
