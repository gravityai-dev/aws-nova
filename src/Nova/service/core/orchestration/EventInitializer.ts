/**
 * Event initializer for Nova Speech sessions
 */

import { getPlatformDependencies } from "@gravityai-dev/plugin-base";
import { NovaSpeechConfig, StreamingMetadata } from "../../api/types";
import { EventQueue } from "../streaming";
import { EventMetadataProcessor, EventMetadata } from "../../io/events/metadata/EventMetadataProcessor";
import {
  StartEventBuilder,
  SystemPromptBuilder,
  HistoryEventBuilder,
  AudioEventBuilder,
  EndEventBuilder,
  TextBuilder,
} from "../../io/events/incoming/builders";

const { createLogger } = getPlatformDependencies();

/**
 * Handles initialization of events for Nova Speech sessions
 */
export class EventInitializer {
  private logger = createLogger("EventInitializer");

  /**
   * Sends all initial events to start a session
   */
  async sendInitialEvents(
    config: NovaSpeechConfig,
    promptName: string,
    sessionId: string,
    metadata: StreamingMetadata,
    eventQueue: EventQueue
  ): Promise<void> {
    const eventMetadata: EventMetadata = {
      chatId: metadata.chatId,
      conversationId: metadata.conversationId,
      userId: metadata.userId,
      sessionId,
      promptName,
    };

    // Send start events
    await this.sendStartEvents(config, promptName, eventMetadata, eventQueue);

    // Send system prompt
    if (config.systemPrompt) {
      await this.sendSystemPrompt(config.systemPrompt, promptName, eventMetadata, eventQueue);
    }

    // Send conversation history
    if (config.conversationHistory?.length) {
      await this.sendConversationHistory(config.conversationHistory, promptName, eventMetadata, eventQueue);
    }

    // Send initial request as USER text message (triggers immediate response)
    // DISABLED: Nova Speech requires audio input - text alone causes timeout
    // if (config.initialRequest) {
    //   await this.sendInitialRequest(config.initialRequest, promptName, eventMetadata, eventQueue);
    // }

    // Send direct audio input if provided
    if (config.audioInput) {
      await this.sendAudioInput(config.audioInput, promptName, eventMetadata, eventQueue);
    }
  }

  private async sendStartEvents(
    config: NovaSpeechConfig,
    promptName: string,
    eventMetadata: EventMetadata,
    eventQueue: EventQueue
  ): Promise<void> {
    const inferenceConfig = {
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.2,
      topP: config.topP || 0.2,
    };

    const voiceId = config.voice || "tiffany";
    const startEvents = StartEventBuilder.createStartEvents(promptName, inferenceConfig, voiceId, true, config.tools);

    const eventsWithMetadata = EventMetadataProcessor.addMetadataToEvents(startEvents, eventMetadata);
    eventsWithMetadata.forEach((event) => eventQueue.enqueue(event));
  }

  private async sendSystemPrompt(
    systemPrompt: string,
    promptName: string,
    eventMetadata: EventMetadata,
    eventQueue: EventQueue
  ): Promise<void> {
    const events = SystemPromptBuilder.buildSystemPromptEvents(promptName, systemPrompt);
    const eventsWithMetadata = EventMetadataProcessor.addMetadataToEvents(events, eventMetadata);
    eventsWithMetadata.forEach((event) => eventQueue.enqueue(event));
  }

  private async sendConversationHistory(
    history: any[],
    promptName: string,
    eventMetadata: EventMetadata,
    eventQueue: EventQueue
  ): Promise<void> {
    const events = HistoryEventBuilder.buildHistoryEvents(promptName, history);
    const eventsWithMetadata = EventMetadataProcessor.addMetadataToEvents(events, eventMetadata);
    eventsWithMetadata.forEach((event) => eventQueue.enqueue(event));
  }

  private async sendInitialRequest(
    initialRequest: string,
    promptName: string,
    eventMetadata: EventMetadata,
    eventQueue: EventQueue
  ): Promise<void> {
    this.logger.info("Sending initial request as USER text message", { initialRequest });
    // Send as non-interactive TEXT input (interactive: false) per AWS docs
    const events = TextBuilder.buildTextInputEvents(promptName, initialRequest);
    const eventsWithMetadata = EventMetadataProcessor.addMetadataToEvents(events, eventMetadata);
    eventsWithMetadata.forEach((event) => eventQueue.enqueue(event));
  }

  private async sendAudioInput(
    audioInput: string,
    promptName: string,
    eventMetadata: EventMetadata,
    eventQueue: EventQueue
  ): Promise<void> {
    const audioEvents = AudioEventBuilder.createAudioInputEvents(promptName, "audio-content", audioInput);
    const eventsWithMetadata = EventMetadataProcessor.addMetadataToEvents(audioEvents, eventMetadata);
    eventsWithMetadata.forEach((event) => eventQueue.enqueue(event));

    // Send prompt end after audio
    const promptEndEvent = EndEventBuilder.createPromptEnd(promptName);
    const promptEndWithMetadata = EventMetadataProcessor.addMetadataToEvent(promptEndEvent, eventMetadata);
    eventQueue.enqueue(promptEndWithMetadata);
  }
}
