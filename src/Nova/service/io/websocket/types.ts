/**
 * Types for WebSocket audio handling
 */

import { EventQueue } from "../../core/streaming/EventQueue";
import { EventMetadata } from "../events/metadata/EventMetadataProcessor";

export interface WebSocketAudioSession {
  sessionId: string;
  chatId: string;
  eventQueue: EventQueue;
  isActive: boolean;
  contentName?: string;
  contentStarted?: boolean;
  eventMetadata?: EventMetadata;
}

export interface ControlMessage {
  type: "start" | "stop" | "end";
  [key: string]: any;
}
