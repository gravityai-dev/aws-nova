/**
 * AWS Nova Speech Output Node
 * Generates AI-powered speech from text using AWS Nova Sonic
 */

import { getPlatformDependencies, type EnhancedNodeDefinition } from "@gravityai-dev/plugin-base";
import NovaSpeechExecutor from "./executor";

// Export a function that creates the definition after platform deps are set
export function createNodeDefinition(): EnhancedNodeDefinition {
  const { NodeInputType, AI_RESULT_CHANNEL, SYSTEM_CHANNEL } = getPlatformDependencies();

  return {
    packageVersion: "1.1.15",
    type: "AWSNovaSpeech",
    isService: false,
    name: "AWS Nova Speech",
    description: "Generate AI-powered voice using AWS Nova Sonic",
    category: "AI",
    color: "#FF9900", // AWS Orange
    logoUrl: "https://res.cloudinary.com/sonik/image/upload/v1751366180/gravity/icons/awsIcon.png",
    inputs: [
      {
        name: "input",
        type: NodeInputType.ANY,
        description: "Input data",
      },
      {
        name: "audioInput",
        type: NodeInputType.STRING,
        description: "Base64 encoded audio input for speech-to-speech",
      },
    ],
    outputs: [
      {
        name: "streamId",
        type: NodeInputType.STRING,
        description: "Stream ID for the voice response",
      },
      {
        name: "text",
        type: NodeInputType.STRING,
        description: "Combined text output (transcription + response)",
      },
      {
        name: "conversation",
        type: NodeInputType.OBJECT,
        description: "Combined conversation object with user and assistant messages",
      },
    ],
    configSchema: {
      type: "object",
      properties: {
        systemPrompt: {
          type: "string",
          title: "System Prompt",
          description:
            "System message prompt. Supports template syntax like {{input.fieldName}} to reference input data.",
          default: "",
          "ui:field": "template",
        },
        toolResponse: {
          type: "object",
          title: "Tool Response",
          description: "Optional tool response[] to include in the request. Only sent if not empty.",
          default: {},
          "ui:field": "template",
        },
        audioInput: {
          type: "string",
          title: "Audio Input",
          description: "Base64 encoded audio input.",
          "ui:field": "template",
        },
        conversationHistory: {
          type: "object",
          title: "Conversation History",
          description: "JSON array of conversation history",
          "ui:field": "template",
        },
        voice: {
          type: "string",
          title: "Voice",
          description: "Select the voice for speech generation",
          enum: [
            "tiffany",
            "matthew",
            "amy",
            "ambre",
            "florian",
            "beatrice",
            "lorenzo",
            "greta",
            "lennart",
            "lupe",
            "carlos",
          ],
          enumNames: [
            "Tiffany (English US - Female)",
            "Matthew (English US - Male)",
            "Amy (English GB - Female)",
            "Ambre (French - Female)",
            "Florian (French - Male)",
            "Beatrice (Italian - Female)",
            "Lorenzo (Italian - Male)",
            "Greta (German - Female)",
            "Lennart (German - Male)",
            "Lupe (Spanish - Female)",
            "Carlos (Spanish - Male)",
          ],
          default: "tiffany",
        },
        temperature: {
          type: "number",
          title: "Temperature",
          description: "Controls voice variation (0-1)",
          default: 0.7,
          minimum: 0,
          maximum: 1,
          "ui:widget": "range",
        },
        redisChannel: {
          type: "string",
          title: "Redis Channel",
          description: "Redis channel to publish audio chunks to",
          enum: [AI_RESULT_CHANNEL, SYSTEM_CHANNEL],
          enumNames: ["AI Results", "System Messages"],
          default: AI_RESULT_CHANNEL,
        },
      },
      required: ["voice", "redisChannel"],
      "ui:order": ["systemPrompt", "audioInput", "conversationHistory", "voice", "temperature", "redisChannel"],
    },
    // Declare capabilities
    capabilities: {
      isTrigger: false,
    },
    // Declare credential requirements
    credentials: [
      {
        name: "awsCredential",
        required: true,
        displayName: "AWS Credentials",
        description: "AWS credentials for Nova Sonic API access",
      },
    ],
  };
}

const definition = createNodeDefinition();

export const NovaSpeechNode = {
  definition,
  executor: NovaSpeechExecutor,
};
