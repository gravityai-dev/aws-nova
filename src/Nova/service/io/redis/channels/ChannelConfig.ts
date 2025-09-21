/**
 * Redis channel configuration for Nova Speech
 */

/**
 * Channel names used by Nova Speech
 */
export const CHANNELS = {
  // Audio streaming channel (includes control commands)
  AUDIO_STREAM: 'Audio-Stream',
  
  // Output channel for publishing events
  GRAVITY_OUTPUT: 'gravity:output',
} as const;

/**
 * Channel configuration options
 */
export interface ChannelConfig {
  name: string;
  description: string;
  pattern?: string;
  persistent?: boolean;
}

/**
 * Channel configurations
 */
export const CHANNEL_CONFIGS: Record<string, ChannelConfig> = {
  [CHANNELS.AUDIO_STREAM]: {
    name: CHANNELS.AUDIO_STREAM,
    description: 'Real-time audio streaming channel for Nova Speech input (includes control commands)',
    pattern: 'Audio-Stream',
    persistent: false,
  },
  [CHANNELS.GRAVITY_OUTPUT]: {
    name: CHANNELS.GRAVITY_OUTPUT,
    description: 'Output channel for publishing audio chunks and events',
    pattern: 'gravity:output',
    persistent: true,
  },
};
