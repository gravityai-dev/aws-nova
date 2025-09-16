# Nova Speech Service Architecture Specification

## Overview
The Nova Speech service provides real-time speech-to-speech capabilities using AWS Bedrock's Nova Sonic model. It supports continuous audio streaming, text-to-speech generation, and conversational AI with tool integration.

## Architecture Components

### 1. Entry Points

#### Node Layer (`/node`)
- **executor.ts**: Workflow node executor implementing PromiseNode pattern
  - Detects control signals (START_CALL, END_CALL) from `config.control`
  - Passes configuration to service layer
  - Handles token usage tracking
- **index.ts**: Node definition with inputs/outputs configuration

#### Service Layer (`/service`)
- **index.ts**: Main service entry point (NovaSpeechService)
  - Single public method: `generateSpeechStream()`
  - Delegates to SessionOrchestrator

### 2. Core Processing Flow

#### Session Orchestration (`/orchestration`)
- **SessionOrchestrator.ts**: Manages complete session lifecycle
  - Creates Bedrock client with HTTP/2
  - Initializes session components (EventQueue, SessionManager, StreamHandler)
  - Sends initial events (start, system prompt, history)
  - Handles control signals (START_CALL, END_CALL)
  - Manages audio streaming registration
  - Processes tool responses
  - Builds final results

#### Stream Management (`/stream`)
- **SessionManager.ts**: Tracks active sessions
  - Creates/ends sessions
  - Maintains session state
- **EventQueue.ts**: Thread-safe event queue
  - Enqueue/dequeue operations
  - Blocking wait for events
  - Graceful closure
- **StreamHandler.ts**: Manages Bedrock streaming
  - Starts converse stream
  - Handles input/output coordination
- **InputStreamHandler.ts**: Sends events to Bedrock
  - Manages event serialization
  - Handles stream lifecycle
- **OutputStreamHandler.ts**: Processes Bedrock responses
  - Parses response events
  - Delegates to ResponseProcessor

### 3. Event System

#### Input Events (`/events/in`)
Numbered for execution order:
1. **1_startEvents.ts**: Session initialization
2. **2_systemPromptEvents.ts**: System prompt configuration
3. **3_historyEvents.ts**: Conversation history
4. **4_audioStreamingEvents.ts**: Audio input chunks
4. **4_toolStreamingEvent.ts**: Tool responses
4. **4_userTextEvents.ts**: Text input
5. **5_promptEndEvent.ts**: End of input marker
5. **5_errorRecoveryEvents.ts**: Error handling
6. **6_sessionEndEvent.ts**: Session termination

#### Output Events (`/events/out`)
- **startEvent.ts**: Session start confirmation
- **contentEvents.ts**: Text/audio content
- **toolUseEvents.ts**: Tool invocation requests
- **usageEvents.ts**: Token/duration metrics
- **completionEndEvent.ts**: Stream completion

#### Event Utilities
- **eventHelpers.ts**: ID tracking and metadata
  - Maps chatId → promptName
  - Adds correlation metadata
- **EventMetadataProcessor.ts**: Batch processing with metadata

### 4. Audio Processing

#### Audio Management (`/audio`)
- **AudioBufferManager.ts**: Buffers and publishes audio chunks
  - Accumulates audio data
  - Publishes via `gravityPublish` function
  - Tracks chunk indices

#### Redis Integration (`/redis`)
- **AudioStreamSubscriber.ts**: Receives streaming audio input
  - Polls Redis Streams for audio chunks
  - Routes to active sessions by chatId
  - Automatically wraps each audio chunk with contentStart/contentEnd events
  - Generates unique contentName per audio chunk
  - Manages subscription lifecycle
- **publishAudioChunk.ts**: Publishes audio output chunks
  - Uses `gravityPublish` for universal event publishing
  - Creates GravityEvent structure
- **publishAudioStatus.ts**: Publishes session status events
  - Uses `gravityPublish` for universal event publishing
  - Handles AUDIO_SESSION_READY, AUDIO_SESSION_ENDED, etc.

### 5. Response Processing

#### Processing Pipeline (`/processing`)
- **ResponseProcessor.ts**: Central response handler
  - Routes events by type
  - Manages state transitions
  - Triggers callbacks
- **EventParser.ts**: Parses Bedrock event format
  - Handles various event types
  - Extracts relevant data
- **TextAccumulator.ts**: Accumulates text by role
  - Separates USER (transcription) vs ASSISTANT responses
  - Handles speculative/final stages
- **UsageStatsCollector.ts**: Collects metrics
  - Token counts
  - Audio duration
  - Chunk statistics

### 6. Configuration & Utilities

#### Configuration (`/config`)
- **SessionConfigBuilder.ts**: Validates and builds config
  - Ensures required fields
  - Builds logging context

#### Error Handling (`/errors`)
- **AwsErrorHandler.ts**: AWS-specific error handling
  - Timeout detection
  - Graceful degradation

#### Status Publishing (`/status`)
- **StatusPublisher.ts**: Audio session status events
  - AUDIO_SESSION_READY
  - AUDIO_SESSION_ENDED
  - Error states

#### Client Management (`/client`)
- **BedrockClientFactory.ts**: Creates Bedrock clients
  - HTTP/2 configuration
  - Credential management

### 7. Type Definitions (`/types.ts`)
- **NovaSpeechConfig**: Service configuration
- **StreamUsageStats**: Usage metrics
- **Event interfaces**: All event type definitions

## Key Design Patterns

### 1. Event-Driven Architecture
- All communication via typed events
- Clear input/output event flow
- Metadata tracking throughout

### 2. Stream Processing
- Continuous audio streaming support
- Non-blocking event queues
- Graceful error handling

### 3. Session Management
- Single session per call
- chatId-based correlation
- Clean lifecycle management
- Unique contentName per audio segment

### 4. Redis Integration
- Streams for audio input (avoids pub/sub mode conflicts)
- Universal `gravityPublish` function for all output events
- Fire-and-forget status updates
- Control signals via action field

### 5. Control Signals
- START_CALL: Initialize streaming session
- END_CALL: Clean shutdown
- Passed via config.control from workflow

### 6. Audio Processing
- Each audio chunk automatically wrapped with contentStart/contentEnd
- Unique contentName generated per chunk
- No explicit segment control signals needed

## Audio Streaming Flow

### Call Initialization
1. Client sends START_CALL → Workflow → Nova
2. Nova registers with AudioStreamSubscriber
3. Nova publishes AUDIO_SESSION_READY
4. Client begins streaming audio

### Audio Processing
1. Client sends audio chunks → Redis Stream
2. AudioStreamSubscriber polls and routes by chatId
3. Nova automatically wraps each chunk with contentStart/contentEnd
4. Audio events fed to session EventQueue with unique contentName
5. Bedrock processes audio and returns speech
6. Audio response published via platform.ts publishAudioChunk

### Call Termination
1. Client sends END_CALL → Workflow → Nova
2. Nova unregisters from AudioStreamSubscriber
3. Nova publishes AUDIO_SESSION_ENDED
4. Session cleanup

## Integration Points

### Platform Dependencies
- Uses `@gravityai-dev/plugin-base` for:
  - Redis client access (for reading streams)
  - Universal `gravityPublish` function (for all output)
  - Logging
  - Credential management
  - Token usage tracking

### Redis Channels
- **Input**: Audio chunks via Redis Streams (polling from `local:audio:input:stream`)
- **Output**: All events via `gravityPublish` to `local:workflow:events:stream`
  - Audio chunks (eventType: "audioChunk")
  - Status events (eventType: "state")
  - All use channel: "gravity:output"

### Event Metadata
- chatId: Primary correlation ID
- conversationId: Broader context
- userId: User identifier
- sessionId: Nova session UUID
- promptName: Maps to chatId
- contentName: Unique per audio chunk (chatId_timestamp)

### Data Structure Standards
See AUDIO_EVENT_SPEC.md for detailed event data structures and field specifications.

## Error Handling

### Timeout Management
- Bedrock timeout: Synthetic completionEnd
- Graceful session cleanup
- Status publishing for client notification

### Redis Failures
- Polling continues on transient errors
- "No such key" errors ignored
- Connection retry logic

### Audio Format Errors
- PCM validation
- Base64 encoding checks
- Chunk size limits

## Performance Considerations

### Polling Strategy
- 50ms interval for low latency
- Batch processing (10 messages)
- Non-blocking reads

### Memory Management
- Audio buffer limits
- Event queue size constraints
- Session cleanup on completion

### Concurrency
- Thread-safe event queues
- Multiple concurrent sessions
- nodeId-workflowId filtering

## Future Enhancements

### Planned Features
1. Multi-language support
2. Custom voice training
3. Emotion detection
4. Background noise filtering

### Architecture Extensions
1. WebSocket support for lower latency
2. Direct client streaming (bypass Redis)
3. Distributed session management
4. Advanced audio preprocessing

## Testing Strategy

### Unit Tests
- Event creation/parsing
- Queue operations
- Session management

### Integration Tests
- Redis streaming
- Bedrock API mocking
- End-to-end flows

### Performance Tests
- Latency measurements
- Throughput limits
- Memory usage

## Deployment Considerations

### Environment Variables
- Redis configuration
- AWS credentials
- Namespace isolation

### Scaling
- Horizontal scaling via nodeId
- Redis cluster support
- Session affinity

### Monitoring
- CloudWatch metrics
- Custom event tracking
- Error rate monitoring
