/**
 * AWS error handler for Nova Speech
 */

import { getPlatformDependencies } from '@gravityai-dev/plugin-base';

const { createLogger } = getPlatformDependencies();
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

export interface ErrorSession {
  sessionId: string;
  promptId: string;
  responseProcessor?: {
    handleError: (error: any) => Promise<void>;
  };
}

/**
 * Handles AWS Bedrock errors for Nova Speech
 */
export class AwsErrorHandler {
  /**
   * Handles AWS Bedrock errors with comprehensive logging and specific error type handling
   */
  static async handleStreamError(error: any, session: ErrorSession): Promise<void> {
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

      case "ResourceNotFoundException":
        console.error("❌ RESOURCE NOT FOUND:", error.message);
        logger.error("ResourceNotFoundException - Model not found", errorDetails);
        break;

      case "ThrottlingException":
        logger.error("ThrottlingException - Rate limit exceeded", errorDetails);
        break;

      case "ModelStreamErrorException":
        logger.error("ModelStreamErrorException - Stream processing error", errorDetails);
        break;

      case "InternalServerException":
        logger.error("InternalServerException - AWS service error", errorDetails);
        break;

      case "ServiceUnavailableException":
        logger.error("ServiceUnavailableException - Service temporarily unavailable", errorDetails);
        break;

      case "ModelTimeoutException":
        logger.error("ModelTimeoutException - Model processing timeout", errorDetails);
        break;

      case "ModelNotReadyException":
        logger.error("ModelNotReadyException - Model not ready for requests", errorDetails);
        break;

      default:
        logger.error("Unknown error type", errorDetails);
        break;
    }

    // Log full error details for debugging
    console.error("\n🔴 NOVA SPEECH ERROR DETAILS:");
    console.error("Error Type:", error.name);
    console.error("Error Message:", error.message);
    console.error("HTTP Status:", error.$metadata?.httpStatusCode);
    console.error("Request ID:", error.$metadata?.requestId);
    console.error("CloudFront ID:", error.$metadata?.cfId);
    console.error("Full Error:", error);
  }

  /**
   * Handles validation exceptions specifically
   */
  private static async handleValidationException(error: any, session: ErrorSession): Promise<void> {
    const errorMessage = error.message || "";
    
    if (errorMessage.includes("Timeout waiting for prompt")) {
      console.error("⏱️ TIMEOUT: Nova Speech timed out waiting for prompt events");
      logger.error("Timeout waiting for prompt - likely missing promptEnd event", {
        sessionId: session.sessionId,
        errorMessage,
      });
    } else if (errorMessage.includes("Invalid event structure")) {
      console.error("📋 INVALID EVENT: Event structure validation failed");
      logger.error("Invalid event structure sent to Nova", {
        sessionId: session.sessionId,
        errorMessage,
      });
    } else {
      console.error("❓ VALIDATION ERROR:", errorMessage);
      logger.error("General validation error", {
        sessionId: session.sessionId,
        errorMessage,
      });
    }
  }

  /**
   * Sends cleanup events when an error occurs
   */
  private static async sendErrorCleanupEvents(session: ErrorSession): Promise<void> {
    try {
      // If session has a response processor, let it handle the error
      if (session.responseProcessor?.handleError) {
        await session.responseProcessor.handleError({
          type: "error",
          message: "Stream error occurred",
        });
      }
    } catch (cleanupError) {
      logger.error("Error during cleanup", {
        sessionId: session.sessionId,
        error: cleanupError,
      });
    }
  }

  /**
   * Determines if an error is retryable
   */
  static isRetryableError(error: any): boolean {
    const retryableErrors = [
      "ThrottlingException",
      "ServiceUnavailableException",
      "InternalServerException",
      "ModelNotReadyException",
    ];
    
    return retryableErrors.includes(error.name);
  }

  /**
   * Gets a user-friendly error message
   */
  static getUserFriendlyMessage(error: any): string {
    switch (error.name) {
      case "AccessDeniedException":
        return "Access denied. Please check your AWS credentials and permissions.";
      case "ResourceNotFoundException":
        return "The Nova Speech model was not found. Please check the model ID.";
      case "ThrottlingException":
        return "Rate limit exceeded. Please try again in a few moments.";
      case "ServiceUnavailableException":
        return "The service is temporarily unavailable. Please try again later.";
      case "ValidationException":
        if (error.message?.includes("Timeout")) {
          return "The request timed out. Please try again.";
        }
        return "Invalid request format. Please check your input.";
      default:
        return "An unexpected error occurred. Please try again.";
    }
  }
}
