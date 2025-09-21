# Core Business Logic

This layer contains the core business logic for the Nova Speech service.

## Structure

### `/orchestration`
Manages the overall session lifecycle and coordinates between components.
- `SessionOrchestrator.ts` - Main orchestration logic
- `SessionLifecycle.ts` - Session state management
- `OrchestratorHelpers.ts` - Helper functions for orchestration

### `/streaming`
Handles the streaming infrastructure.
- `EventQueue.ts` - Queue for managing events
- `StreamHandler.ts` - Manages bidirectional streaming
- `SessionManager.ts` - Session state and lifecycle
- `StreamCoordinator.ts` - Coordinates multiple streams

### `/processing`
Processes events and responses.
- `EventParser.ts` - Parses and validates events
- `TextAccumulator.ts` - Accumulates text responses
- `UsageStatsCollector.ts` - Collects usage statistics
- `ResponseProcessor.ts` - Main response processing logic

## Design Principles

1. **Business Logic Only** - No I/O or external dependencies
2. **Testable** - Pure functions where possible
3. **State Management** - Clear state transitions
4. **Error Handling** - Graceful error recovery
