# API Layer

This layer contains the external-facing interfaces and types for the Nova Speech service.

## Structure

### `/client`
AWS Bedrock client configuration and factory.
- `BedrockClientFactory.ts` - Creates configured Bedrock clients
- `ClientConfig.ts` - Client configuration types and defaults

### `/types`
Public types and interfaces that consumers of this service will use.
- `index.ts` - Main export file
- `StreamTypes.ts` - Streaming-related types
- `ConfigTypes.ts` - Configuration types

## Design Principles

1. **Stable Interface** - Changes here affect external consumers
2. **Minimal Dependencies** - Should not depend on internal implementation
3. **Well Documented** - All public types should have JSDoc comments
4. **Version Aware** - Consider backward compatibility
