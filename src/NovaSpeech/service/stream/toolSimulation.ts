/**
 * Tool simulation for Nova Speech
 * Simulates Nova requesting to use a tool and receiving the response
 */

import * as crypto from "crypto";
import { createToolStreamingEvents } from "../events/in/4_toolStreamingEvent";
import { createToolUseRequestEvents } from "../events/out/toolUseEvents";
import { addEventMetadata, EventMetadata } from "../events/eventHelpers";
import { delay } from "./utils/timing";
import { createLogger } from "../redis/publishAudioChunk";

const logger = createLogger("ToolSimulation");

const activeLogger = logger;

export interface ToolSimulationParams {
  sessionId: string;
  promptName: string;
  toolResponse: any[];
  eventQueue: any;
  responseProcessor: any;
  eventMetadata: EventMetadata;
}

/**
 * Simulate tool use flow for Nova Speech
 * 1. Simulates Nova requesting to use the RAGtool
 * 2. Sends the tool response with the provided data
 */
export async function simulateToolUse(params: ToolSimulationParams): Promise<void> {
  const { sessionId, promptName, toolResponse, eventQueue, responseProcessor, eventMetadata } = params;

  // Use the same toolUseId for both request and response
  const toolUseId = crypto.randomUUID();

  activeLogger.info("🔧 Simulating complete tool flow", {
    sessionId,
    toolUseId,
    toolName: "RAGtool",
    responseItemCount: toolResponse.length,
  });

  // Step 1: Create and process Nova's tool use request events
  const toolUseRequestEvents = createToolUseRequestEvents(sessionId, promptName, "RAGtool", toolUseId, {
    query: "search",
  });

  activeLogger.info("📤 Processing tool use request events", {
    eventCount: toolUseRequestEvents.length,
    toolUseId,
  });

  // Don't send output events to the input queue
  // Instead, process them through the response processor to simulate Nova's behavior
  activeLogger.info("🔄 Simulating Nova's tool request by processing output events", {
    toolUseId,
  });

  // Process each output event to simulate Nova requesting the tool
  for (let i = 0; i < toolUseRequestEvents.length; i++) {
    const outputEvent = toolUseRequestEvents[i];
    activeLogger.info(`🔄 Processing output event ${i + 1}/${toolUseRequestEvents.length}`, {
      eventType: Object.keys(outputEvent.event)[0],
      toolUseId: (outputEvent.event as any).toolUse?.toolUseId || "N/A",
    });
    // Add a small delay between events
    await delay(50);
    responseProcessor.processEvent(outputEvent);
  }

  // Wait for processing to complete
  await delay(200);

  // Step 2: Send the tool result input events with the same toolUseId
  const toolResultEvents = createToolStreamingEvents(promptName, toolUseId, toolResponse);

  activeLogger.info("📥 Sending tool result events", {
    eventCount: toolResultEvents.length,
    toolUseId,
    resultPreview: JSON.stringify(toolResponse[0]).substring(0, 100) + "...",
  });

  for (let i = 0; i < toolResultEvents.length; i++) {
    const inputEvent = toolResultEvents[i];
    activeLogger.info(`📥 Sending input event ${i + 1}/${toolResultEvents.length}`, {
      eventType: Object.keys(inputEvent.event)[0],
      toolUseId:
        (inputEvent.event as any).toolResultInputConfiguration?.toolUseId ||
        (inputEvent.event as any).toolResult?.toolUseId ||
        "N/A",
    });
    const trackedEvent = addEventMetadata(inputEvent, eventMetadata);
    eventQueue.enqueue(trackedEvent);
  }

  activeLogger.info("✅ Tool simulation completed", {
    sessionId,
    toolUseId,
  });
}
