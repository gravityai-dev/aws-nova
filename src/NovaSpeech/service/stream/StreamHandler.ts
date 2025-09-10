import { BedrockRuntimeClient, InvokeModelWithBidirectionalStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import { createLogger } from "../../../shared/platform";

const logger = createLogger("StreamHandler");
import { EventQueue } from "./EventQueue";
import { NovaSpeechSession } from "./SessionManager";
import { InputStreamHandler } from "./InputStreamHandler";
import { OutputStreamHandler } from "./OutputStreamHandler";

export class StreamHandler {
  constructor(private bedrockClient: BedrockRuntimeClient) {}

  async startStream(session: NovaSpeechSession, config: { modelId?: string }, eventQueue: EventQueue): Promise<void> {
    try {
      console.log("\n📤 STARTING NOVA SPEECH STREAM");

      // Send request to Nova Speech
      console.log("\n🚀 Sending InvokeModelWithBidirectionalStreamCommand...");
      console.log("Model ID:", config.modelId || "amazon.nova-sonic-v1:0");

      // The SDK expects the body to be an async iterable of chunks
      // EventQueue already implements async iterator that yields { chunk: { bytes: Uint8Array } }
      const response = await this.bedrockClient.send(
        new InvokeModelWithBidirectionalStreamCommand({
          modelId: config.modelId || "amazon.nova-sonic-v1:0",
          body: eventQueue,
        })
      );

      // Process response stream
      await OutputStreamHandler.processResponseStream(response, session);

      logger.info("Stream completed", {
        sessionId: session.sessionId,
      });
    } catch (error: any) {
      // Enhanced error logging for AWS exceptions
      const errorDetails = {
        sessionId: session.sessionId,
        errorType: error.name,
        errorMessage: error.message,
        errorCode: error.$fault,
        httpStatusCode: error.$metadata?.httpStatusCode,
        requestId: error.$metadata?.requestId,
        cfId: error.$metadata?.cfId,
        attempts: error.$metadata?.attempts,
        totalRetryDelay: error.$metadata?.totalRetryDelay,
        stack: error.stack,
      };

      // Log specific AWS Bedrock exceptions
      if (error.name === "ValidationException") {
        logger.error("ValidationException", errorDetails);
        // If it's a timeout error, trigger completion handler to properly close the session
        if (error.message.includes("Timed out waiting for input events")) {
          console.log("⏱️ Timeout detected - synthesizing contentEnd event");
          
          // Simulate a contentEnd event with END_TURN to ensure proper closure
          if (session.responseProcessor) {
            const contentEndEvent = {
              event: {
                contentEnd: {
                  completionId: session.sessionId,
                  contentId: `timeout-${session.sessionId}`,
                  promptName: `prompt-${session.sessionId}`,
                  sessionId: session.sessionId,
                  stopReason: "END_TURN",
                  type: "AUDIO"
                }
              }
            };
            // This will trigger the completion handler automatically
            await session.responseProcessor.processEvent(contentEndEvent);
          }
        }
      } else if (error.name === "AccessDeniedException") {
        console.error("❌ ACCESS DENIED:", error.message);
        logger.error("AccessDeniedException - Insufficient permissions", errorDetails);
      } else if (error.name === "ModelErrorException") {
        console.error("❌ MODEL ERROR:", error.message);
        logger.error("ModelErrorException - Error processing the model", errorDetails);
      } else if (error.name === "ModelNotReadyException") {
        console.error("❌ MODEL NOT READY:", error.message);
        logger.error("ModelNotReadyException - Model not ready for inference", errorDetails);
      } else if (error.name === "ModelStreamErrorException") {
        console.error("❌ MODEL STREAM ERROR:", error.message);
        logger.error("ModelStreamErrorException - Error during streaming", errorDetails);
      } else if (error.name === "ModelTimeoutException") {
        console.error("❌ MODEL TIMEOUT:", error.message);
        logger.error("ModelTimeoutException - Request timed out", errorDetails);
      } else if (error.name === "InternalServerException") {
        console.error("❌ INTERNAL SERVER ERROR:", error.message);
        logger.error("InternalServerException - AWS internal error", errorDetails);
      } else if (error.name === "ServiceQuotaExceededException") {
        console.error("❌ SERVICE QUOTA EXCEEDED:", error.message);
        logger.error("ServiceQuotaExceededException - Quota limit reached", errorDetails);
      } else if (error.name === "ServiceUnavailableException") {
        console.error("❌ SERVICE UNAVAILABLE:", error.message);
        logger.error("ServiceUnavailableException - Service temporarily unavailable", errorDetails);
      } else if (error.name === "ThrottlingException") {
        console.error("❌ THROTTLING ERROR:", error.message);
        logger.error("ThrottlingException - Request rate exceeded", errorDetails);
      } else if (error.name === "ResourceNotFoundException") {
        console.error("❌ RESOURCE NOT FOUND:", error.message);
        logger.error("ResourceNotFoundException - Model or resource not found", errorDetails);
      } else {
        console.error("❌ UNKNOWN STREAM ERROR:", error);
        logger.error("Unknown stream error", errorDetails);
      }

      throw error;
    }
  }
}
