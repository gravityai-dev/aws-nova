# Redis Communication Layer

This layer handles all Redis-based communication for the Nova Speech service.

## Structure

### `/publishers` - Publishing to Redis
Components that publish events and data to Redis.
- `AudioPublisher.ts` - Publishes audio chunks and audio state events
- `StatePublisher.ts` - Publishes session state updates
- `EventPublisher.ts` - General event publishing

### `/subscribers` - Subscribing from Redis
Components that subscribe to Redis channels.
- `AudioSubscriber.ts` - Subscribes to audio input streams
- `ControlSubscriber.ts` - Subscribes to control signals
- `SubscriberManager.ts` - Manages multiple subscriptions

### `/channels` - Channel Configuration
Defines and manages Redis channels.
- `ChannelConfig.ts` - Channel names and configuration
- `ChannelTypes.ts` - Type definitions for channels

## Key Concepts

### Audio Flow
1. **Audio Input**: Client → Redis → AudioSubscriber → Nova
2. **Audio Output**: Nova → AudioPublisher → Redis → Client

### State Management
- Session states published for monitoring
- Control signals for session management

### Channel Naming Convention
- `audio:stream:{sessionId}` - Audio streaming channels
- `control:{workflowId}` - Control signal channels
- `state:{sessionId}` - State update channels

## Design Principles

1. **Fire and Forget** - Publishers don't wait for acknowledgment
2. **Resilient** - Handle Redis connection issues gracefully
3. **Typed Channels** - Strong typing for channel data
4. **Efficient** - Minimize Redis operations
