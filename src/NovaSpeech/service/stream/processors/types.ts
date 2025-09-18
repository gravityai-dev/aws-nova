import type { Logger } from "pino";
import { StreamingMetadata } from "../../types";

export interface ProcessorContext {
  metadata: StreamingMetadata;
  sessionId: string;
  logger: Logger;
}

export interface AudioBufferState {
  buffer: string[];
  size: number;
  timeout: NodeJS.Timeout | null;
  generationComplete: boolean;
}

export interface ProcessorResult {
  success: boolean;
  error?: Error;
}
