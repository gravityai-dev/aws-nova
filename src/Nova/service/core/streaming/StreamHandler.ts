/**
 * Stream handler for Nova Speech bidirectional streaming
 */

import { BedrockRuntimeClient, InvokeModelWithBidirectionalStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import { getPlatformDependencies } from '@gravityai-dev/plugin-base';
import { EventQueue } from "./EventQueue";
import { NovaSpeechSession } from "./SessionManager";

const { createLogger } = getPlatformDependencies();
const logger = createLogger("StreamHandler");

/**
 * Handles bidirectional streaming with AWS Bedrock Nova Speech
 */
export class StreamHandler {
  constructor(private bedrockClient: BedrockRuntimeClient) {}

  /**
   * Starts a bidirectional stream with Nova Speech
   */
  async startStream(
    session: NovaSpeechSession, 
    config: { modelId?: string }, 
    eventQueue: EventQueue,
    outputHandler: (response: any, session: NovaSpeechSession) => Promise<void>
  ): Promise<void> {
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

      // Process response stream using the provided handler
      await outputHandler(response, session);

      logger.info("Stream completed", {
        sessionId: session.sessionId,
      });
    } catch (error: any) {
      logger.error("Stream error", {
        sessionId: session.sessionId,
        error: error.message || error,
        errorType: error.constructor?.name,
        errorCode: error.$metadata?.httpStatusCode,
      });
      
      // Re-throw for upstream handling
      throw error;
    }
  }
}
