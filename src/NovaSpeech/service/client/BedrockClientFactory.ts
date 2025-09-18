import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { NodeHttp2Handler } from "@smithy/node-http-handler";

export interface BedrockClientConfig {
  region?: string;
  requestTimeout?: number;
  sessionTimeout?: number;
  disableConcurrentStreams?: boolean;
  maxConcurrentStreams?: number;
}

export class BedrockClientFactory {
  /**
   * Creates a Bedrock client with explicit configuration
   * No confusing defaults - you specify exactly what you want
   */
  static create(credentials: any, config: Required<BedrockClientConfig>): BedrockRuntimeClient {
    // Create HTTP/2 handler with explicit configuration
    const http2Handler = new NodeHttp2Handler({
      requestTimeout: config.requestTimeout,
      sessionTimeout: config.sessionTimeout,
      disableConcurrentStreams: config.disableConcurrentStreams,
      maxConcurrentStreams: config.maxConcurrentStreams,
    });

    return new BedrockRuntimeClient({
      region: config.region,
      credentials,
      requestHandler: http2Handler,
    });
  }

  /**
   * Nova Speech optimized configuration - explicit and clear
   */
  static readonly NOVA_SPEECH_CONFIG: Required<BedrockClientConfig> = {
    region: "us-east-1",
    requestTimeout: 300000,
    sessionTimeout: 300000,
    disableConcurrentStreams: false, // Nova needs concurrent streams for real-time processing
    maxConcurrentStreams: 5,
  };
}
