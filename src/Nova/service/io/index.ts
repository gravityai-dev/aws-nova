/**
 * I/O components for Nova Speech
 */

// Events
export * from './events';

// Redis
export * from './redis';

// AWS
export { BedrockClientFactory } from './aws/BedrockClientFactory';
export type { BedrockClientConfig, AWSCredentials } from './aws/BedrockClientFactory';
