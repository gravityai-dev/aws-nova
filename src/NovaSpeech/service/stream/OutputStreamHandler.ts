import { createLogger } from "../redis/publishAudioChunk";

const logger = createLogger("OutputStreamHandler");
import { NovaSpeechSession } from "./SessionManager";
import { InvokeModelWithBidirectionalStreamCommandOutput } from "@aws-sdk/client-bedrock-runtime";

/**
 * Handles output stream events from Nova Speech
 * Manages the byte stream of responses from the service
 */
export class OutputStreamHandler {
  /**
   * Processes the response stream from Nova Speech
   * Decodes bytes and passes events to the response processor
   */
  static async processResponseStream(
    response: InvokeModelWithBidirectionalStreamCommandOutput,
    session: NovaSpeechSession
  ): Promise<void> {
    if (!response.body) {
      throw new Error("No response body from Nova Speech");
    }

    console.log("\n📥 PROCESSING NOVA SPEECH RESPONSE STREAM");
    console.log("Response metadata:", response.$metadata);
    let responseEventCount = 0;
    let lastEventTime = Date.now();

    try {
      console.log("\n⏳ Waiting for events from response.body stream...");
      console.log("Response body type:", typeof response.body);
      console.log("Response body constructor:", response.body?.constructor?.name);
      console.log("Is AsyncIterable:", response.body && typeof response.body[Symbol.asyncIterator] === "function");

      const startTime = Date.now();
      let iterationCount = 0;

      console.log("\n🎯 About to enter for-await loop...");
      for await (const event of response.body) {
        iterationCount++;

        responseEventCount++;

        if (!session.isActive) {
          logger.info("Session ended, stopping stream", {
            sessionId: session.sessionId,
            eventsProcessed: responseEventCount,
          });
          break;
        }

        if (event.chunk?.bytes) {
          const textResponse = new TextDecoder().decode(event.chunk.bytes);
          try {
            const jsonResponse = JSON.parse(textResponse);
            const eventType = jsonResponse.event ? Object.keys(jsonResponse.event)[0] : "unknown";

            // Only log non-audioOutput events to reduce noise
            if (eventType !== "audioOutput") {
              console.log(`\n🟢 RECEIVED EVENT #${responseEventCount} - Type: ${eventType}`);
            } else {
              // For audioOutput, update the same line
              process.stdout.write(
                `\r🟢 RECEIVED EVENT #${responseEventCount} - Type: ${eventType}                    `
              );
            }

            // Log full event details for debugging (skip for now - handled in parseOutputEvent)

            await session.responseProcessor.processEvent(jsonResponse);
          } catch (parseError: any) {
            console.error(`\n❌ PARSE ERROR for event #${responseEventCount}:`);
            console.error("Error details:", parseError.message);
            console.error("Raw response (first 500 chars):", textResponse.substring(0, 500));

            logger.error("Failed to parse stream event", {
              sessionId: session.sessionId,
              errorType: parseError.name,
              errorMessage: parseError.message,
              eventNumber: responseEventCount,
              rawDataLength: textResponse.length,
              rawDataPreview: textResponse.substring(0, 500),
            });
            // Continue processing other events
          }
        } else if (event.modelStreamErrorException) {
          console.error(`\n❌ MODEL STREAM ERROR:`, event.modelStreamErrorException);
          logger.error("Model stream error from Nova", {
            sessionId: session.sessionId,
            error: event.modelStreamErrorException,
          });

          // Handle gracefully - synthesize completion and continue
          console.log("\n⚠️ Nova encountered an error - ending session gracefully");
          const syntheticCompletionEnd = {
            event: {
              completionEnd: {
                promptName: session.sessionId,
                completionId: `error-${Date.now()}`,
                stopReason: "END_TURN" as const,
              },
            },
          };
          await session.responseProcessor.processEvent(syntheticCompletionEnd);

          // Don't throw - let the session end gracefully
          break;
        } else if (event.internalServerException) {
          console.error(`\n❌ INTERNAL SERVER ERROR:`, event.internalServerException);
          logger.error("Internal server error from Nova", {
            sessionId: session.sessionId,
            error: event.internalServerException,
          });

          // Handle gracefully - synthesize completion and continue
          console.log("\n⚠️ Nova internal error - ending session gracefully");
          const syntheticCompletionEnd = {
            event: {
              completionEnd: {
                promptName: session.sessionId,
                completionId: `internal-error-${Date.now()}`,
                stopReason: "END_TURN" as const,
              },
            },
          };
          await session.responseProcessor.processEvent(syntheticCompletionEnd);

          // Don't throw - let the session end gracefully
          break;
        }
      }

      console.log("\n🏁 Exited for-await loop");
      console.log(`\n✅ TOTAL RESPONSE EVENTS PROCESSED: ${responseEventCount}\n`);
      logger.info("Stream processing completed", {
        sessionId: session.sessionId,
        totalEvents: responseEventCount,
      });
    } catch (error: any) {
      console.error("\n❌ ERROR IN RESPONSE STREAM PROCESSING:");
      console.error("Error type:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      console.error("Events processed before error:", responseEventCount);

      // Handle Nova timeout gracefully - this happens when there's a long period of silence
      if (error.name === "ValidationException" && error.message === "Timed out waiting for input events") {
        console.log("\n⏱️ Nova timed out due to silence - gracefully ending session");
        logger.info("Nova timeout - ending session gracefully", {
          sessionId: session.sessionId,
          eventsProcessed: responseEventCount,
        });

        // Synthesize a completion event to properly close the session
        const syntheticCompletionEnd = {
          event: {
            completionEnd: {
              promptName: session.sessionId,
              completionId: `timeout-${Date.now()}`,
              stopReason: "END_TURN" as const, // Use valid stop reason
            },
          },
        };

        // Process the synthetic completion to update stats
        await session.responseProcessor.processEvent(syntheticCompletionEnd);

        // Don't throw - let the session end gracefully
        return;
      }

      // Handle HTTP/2 stream reset errors gracefully
      if (error.name === "ValidationException" && error.message.includes("RST_STREAM")) {
        console.log("\n🔄 HTTP/2 stream reset - ending session gracefully");
        logger.info("HTTP/2 stream reset - ending session gracefully", {
          sessionId: session.sessionId,
          eventsProcessed: responseEventCount,
          errorMessage: error.message,
        });

        // Synthesize a completion event to properly close the session
        const syntheticCompletionEnd = {
          event: {
            completionEnd: {
              promptName: session.sessionId,
              completionId: `stream-reset-${Date.now()}`,
              stopReason: "END_TURN" as const,
            },
          },
        };

        // Process the synthetic completion to update stats
        await session.responseProcessor.processEvent(syntheticCompletionEnd);

        // Don't throw - let the session end gracefully
        return;
      }

      // For other errors, still throw
      throw error;
    }
  }
}
