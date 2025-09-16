# Audio Event Data Structure Specification

## Overview
This document defines the standardized data structure for audio events and control signals in the Nova Speech streaming system.

## Event Types

### 1. Control Signals (via GraphQL)
Control signals are sent through the standard GraphQL `talkToAgent` mutation with specific metadata.

#### START_CALL
Initiates an audio streaming session.
```javascript
{
  message: "Start call",
  userId: string,
  chatId: string,
  conversationId: string,
  workflowId: string,
  targetTriggerNode: string,
  silent: false,
  isAudio: true,  // Must be true to avoid triggering new workflow
  metadata: {
    action: "START_CALL",
    isAction: true,
    workflowId: string,
    continuousStream: true
  }
}
```

#### END_CALL
Terminates an audio streaming session.
```javascript
{
  message: "End call",
  userId: string,
  chatId: string,
  conversationId: string,
  workflowId: string,
  targetTriggerNode: string,
  silent: false,
  isAudio: true,  // Must be true to avoid triggering new workflow
  metadata: {
    action: "END_CALL",
    isAction: true,
    workflowId: string
  }
}
```

### 2. Audio Data Chunks (via Redis Stream)
Actual audio data sent during active speech.

```javascript
{
  message: string,  // Base64 encoded PCM audio data
  userId: string,
  chatId: string,  // Must match session chatId
  conversationId: string,
  workflowId: string,
  targetTriggerNode: string,
  silent: false,
  isAudio: true,
  metadata: {
    nodeId: string,  // e.g., "awsnovaspeech1"
    workflowId: string,
    audioFormat: "pcm",
    sampleRate: 16000,
    continuousStream: true
    // Note: No action field for audio data
  }
}
```

## Redis Stream Structure

### Publishing to Redis

#### Audio Input (Client → Nova)
The `gravityTalkToAgent` resolver publishes to `local:audio:input:stream`:

```javascript
// For audio data chunks
{
  chatId: string,
  conversationId: string,
  userId: string,
  audioInput: string,  // Base64 PCM data
  nodeId: string,  // Format: "${nodeId}-${workflowId}"
  workflowId: string,
  timestamp: number
  // Note: No action field for audio data
}
```

#### Audio Output (Nova → Client)
Nova publishes audio chunks using `gravityPublish` to `local:workflow:events:stream`:

```javascript
{
  id: string,
  timestamp: string,
  providerId: string,
  chatId: string,
  conversationId: string,
  userId: string,
  __typename: "GravityEvent",
  type: "GRAVITY_EVENT",
  eventType: "audioChunk",
  data: {
    audioData: string,  // Base64 encoded audio
    format: string,     // "lpcm"
    sourceType: string, // "NovaSpeech"
    index: number,
    sessionId: string,
    metadata: object
  }
}
```

#### Status Events
Nova publishes status events using `gravityPublish`:

```javascript
{
  __typename: "GravityEvent",
  type: "GRAVITY_EVENT", 
  eventType: "state",
  data: {
    state: "AUDIO_SESSION_READY" | "AUDIO_SESSION_ENDED" | "AUDIO_ERROR",
    message?: string,
    error?: string,
    workflowId: string,
    workflowRunId: string
  }
}
```

## Flow Sequence

### 1. Call Initialization
```
Client → GraphQL (START_CALL) → Workflow → Nova Node → Session Created
```

### 2. Audio Streaming
```
User speaks → Client detects speech → Client streams audio chunks → Redis Stream
Nova automatically wraps chunks with contentStart/contentEnd events
Nova processes audio → Returns audio response
```

### 3. Call Termination
```
Client → GraphQL (END_CALL) → Workflow → Nova Node → Session Cleanup
```

## Key Design Decisions

1. **Dual Channel Approach**:
   - Control signals (START_CALL, END_CALL) go through GraphQL/Workflow
   - Audio data chunks go through Redis Stream

2. **Automatic Segment Management**:
   - Nova automatically creates contentStart when receiving first audio chunk
   - Nova automatically creates contentEnd based on silence detection or chunk boundaries
   - No explicit segment control signals needed from client

3. **NodeId Format**:
   - Redis uses composite format: `${nodeId}-${workflowId}`
   - This allows multiple Nova instances to filter their specific audio

4. **ChatId Consistency**:
   - All events in a session MUST use the same chatId
   - This is the primary correlation identifier

5. **Audio Format**:
   - `audioFormat: "pcm"` for audio data chunks
   - 16kHz, 16-bit PCM, mono, Base64 encoded

## Implementation Notes

1. **Client Side**:
   - Use `createMessageParams` helper for consistent structure
   - Set `isAudio: false` for START_CALL/END_CALL
   - Set `isAudio: true` for audio data chunks
   - No need to send segment control signals

2. **Server Side (gravityTalkToAgent)**:
   - Check `metadata.action` for START_CALL/END_CALL only
   - Publish audio chunks to Redis Stream if `metadata.workflowId && metadata.nodeId`
   - No action field needed for audio data

3. **Nova Side (AudioStreamSubscriber)**:
   - Automatically wrap audio chunks with contentStart/contentEnd
   - Generate unique `contentName` per audio chunk or batch
   - Handle silence detection internally

## Error Handling

1. **Missing Session**: Log warning but don't crash
2. **Wrong NodeId**: Skip processing (different Nova instance)
3. **Missing ContentName**: Auto-create with timestamp
4. **Invalid Audio Format**: Log error and skip chunk

## Future Considerations

1. **Binary Protocol**: Consider protobuf for audio chunks
2. **Compression**: Add audio compression support
3. **Multi-Stream**: Support multiple audio streams per session
4. **Metrics**: Add latency and quality metrics
