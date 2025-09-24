/**
 * I/O components for Nova Speech
 */

// Events
export * from "./events";

// AWS
export { BedrockClientFactory } from "./aws/BedrockClientFactory";
export type { BedrockClientConfig, AWSCredentials } from "./aws/BedrockClientFactory";
