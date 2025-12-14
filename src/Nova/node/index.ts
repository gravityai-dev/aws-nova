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
    packageVersion: "1.2.1",
    type: "AWSNovaSpeech",
    isService: false,
    name: "AWS Nova Speech",
    description: "Generate AI-powered voice using AWS Nova Sonic",
    category: "AI",
    color: "#FF9900",
    logoUrl: "https://res.cloudinary.com/sonik/image/upload/v1751366180/gravity/icons/awsIcon.png",
    inputs: [
      {
        name: "input",
        type: NodeInputType.ANY,
        description: "Input data",
      },
    ],
    outputs: [
      {
        name: "text",
        type: NodeInputType.OBJECT,
        description: "Conversation object with query (user transcription) and response (assistant text)",
      },
      {
        name: "conversation",
        type: NodeInputType.OBJECT,
        description: "Combined conversation object with user and assistant messages",
      },
      {
        name: "mcpResult",
        type: NodeInputType.OBJECT,
        description: "MCP tool results",
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
        conversationHistory: {
          type: "object",
          title: "Conversation History",
          description: "JSON array of conversation history",
          "ui:field": "template",
        },
        initialRequest: {
          type: "string",
          title: "Initial Request",
          description:
            "Text sent as USER message at call start - Nova responds immediately (e.g., 'hello' triggers greeting)",
          default: "",
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
        maxTokens: {
          type: "number",
          title: "Max Tokens",
          description: "Maximum number of tokens to generate",
          default: 2000,
          minimum: 100,
          maximum: 4096,
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
      "ui:order": ["systemPrompt", "conversationHistory", "initialRequest", "voice", "temperature", "redisChannel"],
    },
    // Declare capabilities
    capabilities: {
      isTrigger: false,
    },
    // Service connectors - MCP protocol for dynamic tool discovery
    serviceConnectors: [
      {
        name: "mcpService",
        description: "MCP service connector - automatic schema discovery",
        serviceType: "mcp",
        isService: false, // This node CONSUMES MCP services from others
      },
    ],
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

export const NovaSpeechNode = {
  get definition() {
    return createNodeDefinition();
  },
  executor: NovaSpeechExecutor,
};
