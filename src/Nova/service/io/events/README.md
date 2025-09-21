# Events Layer

This layer handles all event-related functionality for Nova Speech communication.

## Structure

### `/incoming` - Events TO Nova
Events that we send to Nova Speech service.

#### `/builders`
- `StartEventBuilder.ts` - Builds session start events
- `SystemPromptBuilder.ts` - Builds system prompt events
- `HistoryEventBuilder.ts` - Builds conversation history events
- `AudioEventBuilder.ts` - Builds audio input events
- `ToolResponseBuilder.ts` - Builds tool response events
- `EndEventBuilder.ts` - Builds session end events

#### `/types`
- `StartEvents.ts` - Types for start/configuration events
- `ContentEvents.ts` - Types for content events
- `ControlEvents.ts` - Types for control events

### `/outgoing` - Events FROM Nova
Events that we receive from Nova Speech service.

#### `/handlers`
- `CompletionHandler.ts` - Handles completion events
- `ContentHandler.ts` - Handles content events
- `AudioHandler.ts` - Handles audio output events
- `ToolUseHandler.ts` - Handles tool use requests
- `UsageHandler.ts` - Handles usage statistics

#### `/types`
- `ResponseEvents.ts` - Types for response events
- `StreamEvents.ts` - Types for streaming events
- `ErrorEvents.ts` - Types for error events

### `/metadata`
Handles event metadata and correlation.
- `EventMetadataProcessor.ts` - Processes and attaches metadata
- `MetadataBuilder.ts` - Builds metadata objects
- `MetadataTypes.ts` - Metadata type definitions

### `/docs`
Documentation and supporting materials.
- `event-flow.md` - Event flow documentation
- `/images` - Diagrams and screenshots

## Design Principles

1. **Clear Direction** - Incoming vs Outgoing is always clear
2. **Single Responsibility** - Each builder/handler does one thing
3. **Type Safety** - Strong typing for all events
4. **Immutability** - Events are immutable once created
