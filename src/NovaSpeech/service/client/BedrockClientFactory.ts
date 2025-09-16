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
   * Creates a Bedrock client with optimized HTTP/2 handler for Nova Speech
   */
  static createClient(
    credentials: any, 
    config: BedrockClientConfig = {}
  ): BedrockRuntimeClient {
    const {
      region = "us-east-1",
      requestTimeout = 300000,
      sessionTimeout = 300000,
      disableConcurrentStreams = true,
      maxConcurrentStreams = 5,
    } = config;

    // Create HTTP/2 handler optimized for streaming
    const http2Handler = new NodeHttp2Handler({
      requestTimeout,
      sessionTimeout,
      disableConcurrentStreams,
      maxConcurrentStreams,
    });

    return new BedrockRuntimeClient({
      region,
      credentials,
      requestHandler: http2Handler,
    });
  }

  /**
   * Creates a client with default Nova Speech optimizations
   */
  static createNovaSpeechClient(credentials: any): BedrockRuntimeClient {
    return this.createClient(credentials, {
      region: "us-east-1",
      requestTimeout: 300000,
      sessionTimeout: 300000,
      disableConcurrentStreams: true,
      maxConcurrentStreams: 5,
    });
  }
}
