/**
 * Type definitions for Redis channel messages
 */

/**
 * Audio segment action types
 * Control commands are embedded within audio messages
 */
export type AudioAction = 
  | 'START_AUDIO_SEGMENT' 
  | 'END_AUDIO_SEGMENT' 
  | 'SEND_AUDIO'
  | 'START_CALL'
  | 'END_CALL';

/**
 * Audio segment message structure
 * Combines audio data with control commands
 */
export interface AudioSegmentMessage {
  action: AudioAction;
  chatId: string;
  nodeId: string;
  workflowId: string;
  audioData?: string;
  timestamp: number;
  metadata?: {
    sampleRate?: number;
    encoding?: string;
    channelCount?: number;
  };
}

