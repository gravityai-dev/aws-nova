/**
 * AWS Nova Sonic Session and Prompt Start Events Builder
 * Based on: https://docs.aws.amazon.com/nova/latest/userguide/input-events.html
 */

// Type definitions
export type ContentType = "AUDIO" | "TEXT" | "TOOL";
export type AudioType = "SPEECH";
export type AudioMediaType = "audio/lpcm";
export type TextMediaType = "text/plain" | "application/json";

export interface InferenceConfiguration {
  maxTokens?: number;
  topP?: number;
  temperature?: number;
}

export interface SessionStartEvent {
  event: {
    sessionStart: {
      inferenceConfiguration?: InferenceConfiguration;
      audioOutputConfiguration?: {
        sampleRate?: number;
        bitDepth?: number;
        channels?: number;
      };
    };
  };
}

export interface PromptStartEvent {
  event: {
    promptStart: {
      promptName: string;
      textOutputConfiguration?: {
        mediaType: string;
      };
      audioOutputConfiguration?: {
        mediaType: string;
        sampleRateHertz: 8000 | 16000 | 24000;
        sampleSizeBits: number;
        channelCount: number;
        voiceId:
          | "matthew"
          | "tiffany"
          | "amy"
          | "lupe"
          | "carlos"
          | "ambre"
          | "florian"
          | "greta"
          | "lennart"
          | "beatrice"
          | "lorenzo";
        encoding: string;
        audioType: string;
      };
      toolUseOutputConfiguration?: {
        mediaType: "application/json";
      };
      toolConfiguration?: {
        toolChoice?: {
          tool: { name: string };
        };
        tools: Array<{
          toolSpec: {
            name: string;
            description: string;
            inputSchema: {
              json: string; // JSON schema as string, e.g. "{\"type\":\"object\",\"properties\":{...}}"
            };
          };
        }>;
      };
    };
  };
}

/**
 * Builds start events for Nova Speech sessions
 */
export class StartEventBuilder {
  /**
   * Session start event - initializes the session with inference configuration
   */
  static createSessionStartEvent(
    temperature: number = 0.2,
    maxTokens: number = 4096,
    topP: number = 0.2
  ): SessionStartEvent {
    const event = {
      event: {
        sessionStart: {
          inferenceConfiguration: {
            maxTokens,
            topP,
            temperature,
          },
        },
      },
    };
    console.log("🎯 SESSION START EVENT:", JSON.stringify(event, null, 2));
    return event;
  }

  /**
   * Prompt start event - defines conversation configuration
   */
  static createPromptStartEvent(
    promptName: string,
    voiceId: string,
    enableTextOutput: boolean = true,
    tools?: any[]
  ): PromptStartEvent {
    type ValidVoiceId =
      | "matthew"
      | "tiffany"
      | "amy"
      | "lupe"
      | "carlos"
      | "ambre"
      | "florian"
      | "greta"
      | "lennart"
      | "beatrice"
      | "lorenzo";

    const validVoices: ValidVoiceId[] = [
      "matthew",
      "tiffany",
      "amy",
      "lupe",
      "carlos",
      "ambre",
      "florian",
      "greta",
      "lennart",
      "beatrice",
      "lorenzo",
    ];

    if (!validVoices.includes(voiceId as ValidVoiceId)) {
      throw new Error(`Invalid voiceId: ${voiceId}. Must be one of: ${validVoices.join(", ")}`);
    }

    console.log("🎯 [VOICE DEBUG] createPromptStartEvent creating event with voiceId:", voiceId);

    const promptStartEvent: any = {
      event: {
        promptStart: {
          promptName,
          textOutputConfiguration: {
            mediaType: "text/plain",
          },
          audioOutputConfiguration: {
            audioType: "SPEECH",
            encoding: "base64",
            mediaType: "audio/lpcm" as AudioMediaType,
            sampleRateHertz: 24000,
            sampleSizeBits: 16,
            channelCount: 1,
            voiceId: voiceId as ValidVoiceId,
          },
          ...(tools && tools.length > 0 ? {
            toolUseOutputConfiguration: {
              mediaType: "application/json",
            },
            toolConfiguration: {
              tools: tools,
              toolChoice: {
                any: {} // This forces Nova to use one of the available tools
              }
            },
          } : {}),
        },
      },
    };
    console.log("🎯 PROMPT START EVENT:", JSON.stringify(promptStartEvent, null, 2));
    return promptStartEvent;
  }

  /**
   * Helper to create both session start and prompt start events
   */
  static createStartEvents(
    promptName: string,
    config: InferenceConfiguration = {},
    voiceId: string = "matthew",
    enableTextOutput: boolean = true,
    tools?: any[]
  ): any[] {
    console.log("🎯 [VOICE DEBUG] createStartEvents called with:", {
      promptName,
      voiceId,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      enableTextOutput,
      hasTools: !!tools,
      toolCount: tools?.length || 0,
    });

    return [
      this.createSessionStartEvent(config.temperature, config.maxTokens, config.topP),
      this.createPromptStartEvent(promptName, voiceId, enableTextOutput, tools),
    ];
  }
}
