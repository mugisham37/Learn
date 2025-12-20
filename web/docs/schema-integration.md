# GraphQL Schema Integration

This document describes the GraphQL schema integration system that automatically synchronizes the frontend with the backend GraphQL schema.

## Overview

The schema integration system provides:

- **Automatic Schema Extraction**: Fetches the complete GraphQL schema from the running backend server
- **Type Generation**: Generates TypeScript types for all backend entities, inputs, and responses
- **Schema Validation**: Validates schema compatibility and detects breaking changes
- **Automated Workflow**: Provides scripts and utilities for seamless schema synchronization

## Requirements Addressed

- **1.1**: Automatic schema fetching from running backend server
- **1.2**: TypeScript type generation using GraphQL Code Generator
- **1.3**: Schema validation and compatibility checking
- **1.5**: Automated schema synchronization workflow

## Components

### 1. Schema Extraction Script (`scripts/extract-schema.js`)

Fetches the GraphQL schema from the backend server and saves it to `schema.graphql`.

```bash
# Extract schema from backend
npm run schema:extract

# Extract with custom endpoint
NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:4000/graphql npm run schema:extract
```

**Features:**
- Automatic retry with exponential backoff
- Schema validation and health checks
- Backup creation before updates
- Change detection and reporting
- Comprehensive error handling

### 2. Schema Validation Script (`scripts/validate-schema.js`)

Validates the GraphQL schema for completeness and compatibility.

```bash
# Validate current schema
npm run schema:validate
```

**Validation Checks:**
- Schema structure validation
- Operation completeness analysis
- Health score calculation (0-100)
- Missing scalar detection
- Placeholder operation detection
- Compatibility recommendations

### 3. Schema Synchronization Workflow (`scripts/sync-schema.js`)

Provides automated workflow for schema synchronization with validation and code generation.

```bash
# One-time synchronization
npm run schema:sync

# Continuous synchronization (watch mode)
npm run schema:watch

# Check synchronization status
npm run schema:status
```

**Workflow Steps:**
1. Extract schema from backend (with retries)
2. Validate schema structure and health
3. Generate TypeScript types
4. Report results and recommendations

### 4. Schema Integration Utilities (`src/lib/schema/`)

TypeScript utilities for runtime schema management.

```typescript
import { schemaIntegration, useSchemaIntegration } from '@/lib/schema';

// Programmatic schema synchronization
const result = await schemaIntegration.synchronize({
  endpoint: 'http://localhost:3000/graphql',
  validateBeforeUse: true,
  retryAttempts: 3,
});

// React hook for schema management
function SchemaStatus() {
  const {
    isLoading,
    healthScore,
    healthStatus,
    validation,
    sync,
  } = useSchemaIntegration({
    autoSync: true,
    syncInterval: 30000,
  });

  return (
    <div>
      <p>Health Score: {healthScore}/100 ({healthStatus})</p>
      <button onClick={() => sync()}>Sync Schema</button>
    </div>
  );
}
```

### 5. Code Generation Configuration (`codegen.yml`)

Enhanced GraphQL Code Generator configuration for comprehensive type generation.

**Generated Files:**
- `src/types/schema.ts` - Complete TypeScript types with React hooks
- `src/types/forms.ts` - Form-specific types for validation
- `src/types/introspection.json` - Introspection result for development tools
- `src/types/graphql-responses.ts` - Backend integration types

## Usage

### Development Workflow

1. **Start Backend Server**
   ```bash
   cd server
   npm run dev
   ```

2. **Synchronize Schema**
   ```bash
   cd web
   npm run schema:sync
   ```

3. **Start Development with Auto-sync**
   ```bash
   npm run codegen:dev
   ```

### Production Deployment

1. **Extract Schema**
   ```bash
   NEXT_PUBLIC_GRAPHQL_ENDPOINT=https://api.production.com/graphql npm run schema:extract
   ```

2. **Validate Schema**
   ```bash
   npm run schema:validate
   ```

3. **Generate Types**
   ```bash
   npm run codegen:generate
   ```

4. **Build Application**
   ```bash
   npm run build
   ```

### Continuous Integration

```yaml
# .github/workflows/schema-sync.yml
name: Schema Synchronization
on:
  schedule:
    - cron: '0 */6 * * *' # Every 6 hours
  workflow_dispatch:

jobs:
  sync-schema:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
        working-directory: web
      
      - name: Synchronize schema
        run: npm run schema:sync
        working-directory: web
        env:
          NEXT_PUBLIC_GRAPHQL_ENDPOINT: ${{ secrets.GRAPHQL_ENDPOINT }}
      
      - name: Create pull request
        if: ${{ github.event_name == 'schedule' }}
        uses: peter-evans/create-pull-request@v4
        with:
          title: 'chore: update GraphQL schema'
          body: 'Automated schema synchronization'
          branch: 'schema-sync'
```

## Configuration

### Environment Variables

```bash
# Backend GraphQL endpoint
NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:3000/graphql

# WebSocket endpoint for subscriptions
NEXT_PUBLIC_WS_ENDPOINT=ws://localhost:3000/graphql
```

### Schema Sync Configuration (`schema-sync.config.json`)

```json
{
  "autoSync": false,
  "validateBeforeCodegen": true,
  "backupOnChanges": true,
  "notifyOnBreakingChanges": true,
  "retryAttempts": 3,
  "retryDelay": 5000,
  "healthCheckThreshold": 60,
  "endpoints": {
    "development": "http://localhost:3000/graphql",
    "staging": "https://api-staging.example.com/graphql",
    "production": "https://api.example.com/graphql"
  }
}
```

## Health Monitoring

### Health Score Calculation

The system calculates a health score (0-100) based on:

- **Query Type Presence** (20 points)
- **Mutation Type Presence** (15 points)
- **Subscription Type Presence** (10 points)
- **Operation Completeness** (35 points total)
  - Queries: 20 points
  - Mutations: 15 points
- **Type Richness** (10 points for >10 custom types)

### Health Status Levels

- **Excellent** (80-100): Schema is production-ready
- **Good** (60-79): Schema is functional with minor improvements needed
- **Fair** (40-59): Schema needs improvements
- **Poor** (0-39): Schema has significant issues

### Common Issues and Recommendations

| Issue | Recommendation |
|-------|----------------|
| Placeholder operations (`_empty`) | Replace with real implementations |
| Missing scalars (DateTime, JSON, Upload) | Add required scalar definitions |
| Low query count (<5) | Add more query operations for API coverage |
| No mutations | Add CRUD mutation operations |
| No subscriptions | Consider real-time features |
| Missing documentation | Add GraphQL descriptions |

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure backend server is running
   - Check GraphQL endpoint URL
   - Verify network connectivity

2. **Schema Validation Errors**
   - Check GraphQL schema syntax
   - Ensure all required types are defined
   - Verify scalar definitions

3. **Type Generation Failures**
   - Check codegen configuration
   - Ensure GraphQL operations are valid
   - Verify schema compatibility

4. **Outdated Types**
   - Run `npm run schema:sync`
   - Check for schema changes
   - Regenerate types with `npm run codegen`

### Debug Commands

```bash
# Check schema status
npm run schema:status

# Validate current schema
npm run schema:validate

# Force schema re-extraction
npm run schema:extract

# Generate types without schema extraction
npm run codegen:generate
```

### Log Files

- `schema-validation-report.json` - Detailed validation results
- `schema-metadata.json` - Schema extraction metadata
- `.schema-sync.lock` - Synchronization lock file

## Best Practices

1. **Regular Synchronization**
   - Set up automated schema synchronization
   - Monitor schema health regularly
   - Address validation warnings promptly

2. **Version Control**
   - Commit generated types to version control
   - Review schema changes in pull requests
   - Use semantic versioning for breaking changes

3. **Testing**
   - Test schema changes in development
   - Validate operations against new schema
   - Run integration tests after updates

4. **Documentation**
   - Document schema changes
   - Update API documentation
   - Communicate breaking changes to team

5. **Monitoring**
   - Set up health score alerts
   - Monitor schema extraction failures
   - Track schema evolution over time

## Integration with Development Tools

### VS Code Extensions

- **GraphQL** - Syntax highlighting and validation
- **Apollo GraphQL** - Schema introspection and autocomplete
- **TypeScript Importer** - Auto-import generated types

### Development Server Integration

The schema integration works seamlessly with Next.js development server:

```bash
# Start with auto-sync
npm run codegen:dev

# This will:
# 1. Extract schema from backend
# 2. Generate types
# 3. Watch for schema changes
# 4. Auto-regenerate types on changes
```

## Performance Considerations

- **Schema Extraction**: ~1-3 seconds depending on schema size
- **Type Generation**: ~2-5 seconds for complete regeneration
- **Validation**: ~100-500ms for health checks
- **Memory Usage**: ~50-100MB during generation process

## Security Considerations

- Schema extraction uses introspection queries (disable in production if needed)
- No sensitive data is stored in generated types
- Endpoint URLs should use environment variables
- Consider rate limiting for automated synchronization

## Future Enhancements

- **Schema Diffing**: Semantic schema comparison for better change detection
- **Breaking Change Detection**: Advanced analysis of breaking changes
- **Performance Metrics**: Track schema evolution and performance impact
- **Team Notifications**: Slack/email notifications for schema changes
- **Schema Registry**: Integration with schema registry services
- **Automated Testing**: Generate tests from schema changes