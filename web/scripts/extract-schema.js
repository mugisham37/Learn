#!/usr/bin/env node

/**
 * GraphQL Schema Extraction Script
 *
 * This script extracts the complete GraphQL schema from the running backend server
 * and saves it to schema.graphql for code generation.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */

const fs = require('fs');
const path = require('path');
const { getIntrospectionQuery, buildClientSchema, printSchema } = require('graphql');

// Configuration
const BACKEND_ENDPOINT =
  process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql';
const SCHEMA_OUTPUT_PATH = path.join(__dirname, '..', 'schema.graphql');
const BACKUP_SCHEMA_PATH = path.join(__dirname, '..', 'schema.backup.graphql');
const SCHEMA_METADATA_PATH = path.join(__dirname, '..', 'schema-metadata.json');

/**
 * Fetches the GraphQL schema from the backend server
 */
async function fetchSchema() {
  console.log(`🔍 Fetching GraphQL schema from ${BACKEND_ENDPOINT}...`);

  try {
    // Dynamic import for fetch (Node.js 18+ or with polyfill)
    const fetch = (await import('node-fetch')).default;

    const introspectionQuery = getIntrospectionQuery();

    const response = await fetch(BACKEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: introspectionQuery,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
    }

    if (!result.data) {
      throw new Error('No data received from GraphQL introspection');
    }

    console.log('✅ Schema fetched successfully');
    return result.data;
  } catch (error) {
    console.error('❌ Failed to fetch schema:', error.message);

    // Check if it's a connection error
    if (error.code === 'ECONNREFUSED' || error.message.includes('fetch')) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('   1. Make sure the backend server is running');
      console.log('   2. Check that the GraphQL endpoint is accessible');
      console.log('   3. Verify the NEXT_PUBLIC_GRAPHQL_ENDPOINT environment variable');
      console.log(`   4. Current endpoint: ${BACKEND_ENDPOINT}`);
    }

    throw error;
  }
}

/**
 * Validates the schema structure
 */
function validateSchema(introspectionResult) {
  console.log('🔍 Validating schema structure...');

  try {
    const schema = buildClientSchema(introspectionResult);

    // Basic validation checks
    const queryType = schema.getQueryType();
    const mutationType = schema.getMutationType();
    const subscriptionType = schema.getSubscriptionType();

    if (!queryType) {
      throw new Error('Schema missing Query type');
    }

    // Count types and operations
    const typeMap = schema.getTypeMap();
    const types = Object.keys(typeMap).filter(name => !name.startsWith('__'));
    const queryFields = Object.keys(queryType.getFields());
    const mutationFields = mutationType ? Object.keys(mutationType.getFields()) : [];
    const subscriptionFields = subscriptionType ? Object.keys(subscriptionType.getFields()) : [];

    console.log('✅ Schema validation passed');
    console.log(`   📊 Types: ${types.length}`);
    console.log(`   📊 Queries: ${queryFields.length}`);
    console.log(`   📊 Mutations: ${mutationFields.length}`);
    console.log(`   📊 Subscriptions: ${subscriptionFields.length}`);

    return {
      valid: true,
      stats: {
        types: types.length,
        queries: queryFields.length,
        mutations: mutationFields.length,
        subscriptions: subscriptionFields.length,
      },
      schema,
    };
  } catch (error) {
    console.error('❌ Schema validation failed:', error.message);
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * Compares new schema with existing schema for breaking changes
 */
function compareSchemas(newSchemaSDL) {
  if (!fs.existsSync(SCHEMA_OUTPUT_PATH)) {
    console.log('📝 No existing schema found - this is the first extraction');
    return { hasChanges: true, breakingChanges: [], safeChanges: [] };
  }

  console.log('🔍 Comparing with existing schema...');

  try {
    const existingSchemaSDL = fs.readFileSync(SCHEMA_OUTPUT_PATH, 'utf8');

    if (existingSchemaSDL === newSchemaSDL) {
      console.log('✅ No schema changes detected');
      return { hasChanges: false, breakingChanges: [], safeChanges: [] };
    }

    // Simple change detection (could be enhanced with proper schema diffing)
    const changes = [];
    const existingLines = existingSchemaSDL.split('\n');
    const newLines = newSchemaSDL.split('\n');

    // Basic line-by-line comparison
    if (existingLines.length !== newLines.length) {
      changes.push(`Schema size changed: ${existingLines.length} -> ${newLines.length} lines`);
    }

    console.log('⚠️  Schema changes detected');
    console.log(`   📝 Changes: ${changes.length || 'Multiple changes detected'}`);

    return {
      hasChanges: true,
      breakingChanges: [], // Would need proper schema diffing to detect
      safeChanges: changes,
    };
  } catch (error) {
    console.warn('⚠️  Could not compare schemas:', error.message);
    return { hasChanges: true, breakingChanges: [], safeChanges: [] };
  }
}

/**
 * Backs up the existing schema
 */
function backupExistingSchema() {
  if (fs.existsSync(SCHEMA_OUTPUT_PATH)) {
    console.log('💾 Backing up existing schema...');
    fs.copyFileSync(SCHEMA_OUTPUT_PATH, BACKUP_SCHEMA_PATH);
    console.log('✅ Schema backed up');
  }
}

/**
 * Saves the schema to file
 */
function saveSchema(schemaSDL, metadata) {
  console.log('💾 Saving schema to file...');

  try {
    // Add header comment to the schema file
    const header = `# GraphQL Schema
# Generated on: ${new Date().toISOString()}
# Source: ${BACKEND_ENDPOINT}
# Types: ${metadata.stats.types} | Queries: ${metadata.stats.queries} | Mutations: ${metadata.stats.mutations} | Subscriptions: ${metadata.stats.subscriptions}
# 
# This file is auto-generated. Do not edit manually.
# Run 'npm run codegen' to regenerate types from this schema.

`;

    const schemaWithHeader = header + schemaSDL;

    fs.writeFileSync(SCHEMA_OUTPUT_PATH, schemaWithHeader, 'utf8');

    // Save metadata
    const metadataContent = {
      extractedAt: new Date().toISOString(),
      endpoint: BACKEND_ENDPOINT,
      stats: metadata.stats,
      version: metadata.version || '1.0.0',
    };

    fs.writeFileSync(SCHEMA_METADATA_PATH, JSON.stringify(metadataContent, null, 2), 'utf8');

    console.log('✅ Schema saved successfully');
    console.log(`   📁 Schema: ${SCHEMA_OUTPUT_PATH}`);
    console.log(`   📁 Metadata: ${SCHEMA_METADATA_PATH}`);
  } catch (error) {
    console.error('❌ Failed to save schema:', error.message);
    throw error;
  }
}

/**
 * Main extraction function
 */
async function extractSchema() {
  console.log('🚀 Starting GraphQL schema extraction...\n');

  try {
    // Step 1: Fetch schema from backend
    const introspectionResult = await fetchSchema();

    // Step 2: Validate schema structure
    const validation = validateSchema(introspectionResult);
    if (!validation.valid) {
      throw new Error(`Schema validation failed: ${validation.error}`);
    }

    // Step 3: Convert to SDL (Schema Definition Language)
    const schemaSDL = printSchema(validation.schema);

    // Step 4: Compare with existing schema
    const comparison = compareSchemas(schemaSDL);

    // Step 5: Backup existing schema if changes detected
    if (comparison.hasChanges) {
      backupExistingSchema();
    }

    // Step 6: Save new schema
    saveSchema(schemaSDL, validation);

    // Step 7: Report results
    console.log('\n🎉 Schema extraction completed successfully!');

    if (comparison.hasChanges) {
      console.log('\n📋 Next steps:');
      console.log('   1. Run "npm run codegen" to generate new TypeScript types');
      console.log('   2. Update your GraphQL operations if needed');
      console.log('   3. Test your application with the new schema');

      if (comparison.breakingChanges.length > 0) {
        console.log('\n⚠️  Breaking changes detected:');
        comparison.breakingChanges.forEach(change => {
          console.log(`   - ${change}`);
        });
      }
    }

    return {
      success: true,
      stats: validation.stats,
      hasChanges: comparison.hasChanges,
    };
  } catch (error) {
    console.error('\n💥 Schema extraction failed:', error.message);

    // Try to restore from backup if available
    if (fs.existsSync(BACKUP_SCHEMA_PATH)) {
      console.log('🔄 Restoring from backup...');
      fs.copyFileSync(BACKUP_SCHEMA_PATH, SCHEMA_OUTPUT_PATH);
      console.log('✅ Schema restored from backup');
    }

    process.exit(1);
  }
}

// Run the extraction if this script is executed directly
if (require.main === module) {
  extractSchema();
}

module.exports = { extractSchema };
