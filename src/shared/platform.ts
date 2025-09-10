/**
 * Shared platform dependencies for all Nova services
 */
import { getPlatformDependencies } from "@gravityai-dev/plugin-base";

// Get platform dependencies once
const deps = getPlatformDependencies();

export const getNodeCredentials = deps.getNodeCredentials;
export const saveTokenUsage = deps.saveTokenUsage;
export const createLogger = deps.createLogger;
export const getConfig = deps.getConfig;
export const PromiseNode = deps.PromiseNode;
export const CallbackNode = deps.CallbackNode;
export const NodeExecutionContext = deps.NodeExecutionContext;
export const getAudioChunkPublisher = deps.getAudioChunkPublisher;
export const AI_RESULT_CHANNEL = deps.AI_RESULT_CHANNEL;

// Create shared loggers
export const novaSpeechLogger = createLogger("NovaSpeech");
