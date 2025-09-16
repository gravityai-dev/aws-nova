import { BedrockRuntimeClient, InvokeModelWithBidirectionalStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import { createLogger } from "../redis/publishAudioChunk";
import { AwsErrorHandler } from "../errors/AwsErrorHandler";

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
      // Use centralized AWS error handling
      await AwsErrorHandler.handleStreamError(error, session);
      throw error;
    }
  }
}
