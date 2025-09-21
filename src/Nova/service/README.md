# Nova Speech Service - Clean Architecture

This is the refactored Nova Speech service with a clean, organized structure.

## Directory Structure

### `/api` - External API Interfaces
- `/client` - AWS Bedrock client management
- `/types` - Public types and interfaces exposed to consumers

### `/core` - Core Business Logic
- `/orchestration` - Session lifecycle and orchestration
- `/streaming` - Stream management and event queuing
- `/processing` - Event processing and response handling

### `/io` - Input/Output Layer
- `/events` - Event definitions and handling
  - `/incoming` - Events sent TO Nova (requests)
  - `/outgoing` - Events received FROM Nova (responses)
  - `/metadata` - Event metadata processing
- `/redis` - Redis communication layer
  - `/publishers` - Publishing events to Redis
  - `/subscribers` - Subscribing to Redis channels
- `/handlers` - Stream I/O handlers

### `/utils` - Shared Utilities
- `/errors` - Error handling and recovery
- `/logging` - Logging utilities
- `/timing` - Timing and delay utilities
- `/validation` - Input validation

### `/config` - Configuration
- Service configuration and defaults

## Key Principles

1. **Separation of Concerns** - Each module has a single, clear responsibility
2. **Dependency Direction** - Dependencies flow inward (utils → io → core → api)
3. **Testability** - Small, focused modules that are easy to test
4. **No Circular Dependencies** - Clear hierarchy prevents circular imports
5. **Type Safety** - Strong typing throughout with clear interfaces

## Migration Status

- [ ] Phase 1: Structure created
- [ ] Phase 2: Types and interfaces defined
- [ ] Phase 3: Core logic migrated
- [ ] Phase 4: I/O layer implemented
- [ ] Phase 5: Testing and validation
- [ ] Phase 6: Old code deprecated
