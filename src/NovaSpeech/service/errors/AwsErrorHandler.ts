import { createLogger } from "../redis/publishAudioChunk";
import { NovaSpeechSession } from "../stream/SessionManager";

const logger = createLogger("AwsErrorHandler");

export interface ErrorDetails {
  sessionId: string;
  errorType: string;
  errorMessage: string;
  errorCode?: string;
  httpStatusCode?: number;
  requestId?: string;
  cfId?: string;
  attempts?: number;
  totalRetryDelay?: number;
  stack?: string;
}

export class AwsErrorHandler {
  /**
   * Handles AWS Bedrock errors with comprehensive logging and specific error type handling
   */
  static async handleStreamError(error: any, session: NovaSpeechSession): Promise<void> {
    const errorDetails: ErrorDetails = {
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
    
    // CRITICAL: Send cleanup events for any error
    await this.sendErrorCleanupEvents(session);

    // Handle specific AWS Bedrock exceptions
    switch (error.name) {
      case "ValidationException":
        logger.error("ValidationException", errorDetails);
        await this.handleValidationException(error, session);
        break;

      case "AccessDeniedException":
        console.error("❌ ACCESS DENIED:", error.message);
        logger.error("AccessDeniedException - Insufficient permissions", errorDetails);
        break;

      case "ModelErrorException":
        console.error("❌ MODEL ERROR:", error.message);
        logger.error("ModelErrorException - Error processing the model", errorDetails);
        break;

      case "ModelNotReadyException":
        console.error("❌ MODEL NOT READY:", error.message);
        logger.error("ModelNotReadyException - Model not ready for inference", errorDetails);
        break;

      case "ModelStreamErrorException":
        console.error("❌ MODEL STREAM ERROR:", error.message);
        logger.error("ModelStreamErrorException - Error during streaming", errorDetails);
        break;

      case "ModelTimeoutException":
        console.error("❌ MODEL TIMEOUT:", error.message);
        logger.error("ModelTimeoutException - Request timed out", errorDetails);
        break;

      case "InternalServerException":
        console.error("❌ INTERNAL SERVER ERROR:", error.message);
        logger.error("InternalServerException - AWS internal error", errorDetails);
        break;

      case "ServiceQuotaExceededException":
        console.error("❌ SERVICE QUOTA EXCEEDED:", error.message);
        logger.error("ServiceQuotaExceededException - Quota limit reached", errorDetails);
        break;

      case "ServiceUnavailableException":
        console.error("❌ SERVICE UNAVAILABLE:", error.message);
        logger.error("ServiceUnavailableException - Service temporarily unavailable", errorDetails);
        break;

      case "ThrottlingException":
        console.error("❌ THROTTLING ERROR:", error.message);
        logger.error("ThrottlingException - Request rate exceeded", errorDetails);
        break;

      case "ResourceNotFoundException":
        console.error("❌ RESOURCE NOT FOUND:", error.message);
        logger.error("ResourceNotFoundException - Model or resource not found", errorDetails);
        break;

      default:
        console.error("❌ UNKNOWN STREAM ERROR:", error);
        logger.error("Unknown stream error", errorDetails);
    }
  }

  /**
   * Handles ValidationException specifically, including timeout scenarios
   */
  private static async handleValidationException(error: any, session: NovaSpeechSession): Promise<void> {
    // Handle timeout errors gracefully with synthetic completionEnd
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
              type: "AUDIO",
            },
          },
        };
        // This will trigger the completion handler automatically
        await session.responseProcessor.processEvent(contentEndEvent);
      }
    }
  }

  /**
   * Checks if an error is a timeout error
   */
  static isTimeoutError(error: any): boolean {
    return error.name === "ValidationException" && error.message.includes("Timed out waiting for input events");
  }

  /**
   * Handles timeout errors in the main service (for index.ts)
   */
  static handleServiceTimeout(error: any, session: NovaSpeechSession): void {
    if (this.isTimeoutError(error)) {
      logger.info("⏱️ Timeout detected - ensuring completion handler is triggered", {
        sessionId: session.sessionId,
      });

      // Trigger completion handler if not already triggered
      if (session.responseProcessor?.onCompletionEnd) {
        session.responseProcessor.onCompletionEnd();
      }
    }
  }
  
  /**
   * Send cleanup events when any error occurs
   * Following AWS Nova best practices: promptEnd, contentEnd, sessionEnd
   */
  private static async sendErrorCleanupEvents(session: NovaSpeechSession): Promise<void> {
    try {
      const eventQueue = session.eventQueue;
      if (!eventQueue) return;
      
      logger.info("Sending error cleanup events", { sessionId: session.sessionId });
      
      // Get chatId from responseProcessor's metadata
      const chatId = (session.responseProcessor as any)?.metadata?.chatId || session.sessionId;
      
      // 1. Send contentEnd if audio was streaming
      if (session.audioContentStartSent) {
        await (eventQueue as any).add({
          event: {
            contentEnd: {
              promptName: chatId,
              contentName: `${chatId}_error_cleanup`,
            },
          },
        });
      }
      
      // 2. Send promptEnd
      await (eventQueue as any).add({
        event: {
          promptEnd: {
            promptName: chatId,
          },
        },
      });
      
      // 3. Send sessionEnd
      await (eventQueue as any).add({
        event: {
          sessionEnd: {},
        },
      });
      
      // Close the event queue
      eventQueue.close();
      
      logger.info("Error cleanup events sent successfully", { sessionId: session.sessionId });
    } catch (cleanupError: any) {
      logger.error("Failed to send error cleanup events", {
        sessionId: session.sessionId,
        error: cleanupError.message,
      });
    }
  }
}
