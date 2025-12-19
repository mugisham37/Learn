/**
 * GraphQL Schema Extraction Script
 * 
 * Extracts the GraphQL schema from the running server for code generation.
 * Enhanced with retry logic and better error handling.
 */

const fs = require('fs');
const path = require('path');
const { buildClientSchema, getIntrospectionQuery, printSchema } = require('graphql');

// Configuration
const CONFIG = {
  maxRetries: 3,
  retryDelay: 2000, // 2 seconds
  timeout: 10000, // 10 seconds
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url, options, timeout = CONFIG.timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Extract schema with retry logic
 */
async function extractSchemaWithRetry(endpoint, retryCount = 0) {
  try {
    console.log(`Attempting to extract schema from: ${endpoint} (attempt ${retryCount + 1}/${CONFIG.maxRetries + 1})`);
    
    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: getIntrospectionQuery({
          descriptions: true,
          schemaDescription: true,
          inputValueDeprecation: true,
          directiveIsRepeatable: true,
          specifiedByUrl: true,
        }),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
    }

    if (!result.data || !result.data.__schema) {
      throw new Error('Invalid introspection result: missing schema data');
    }

    const schema = buildClientSchema(result.data);
    const schemaString = printSchema(schema);
    
    // Write schema to file
    const schemaPath = path.join(__dirname, '..', 'schema.graphql');
    fs.writeFileSync(schemaPath, schemaString, 'utf8');
    
    // Also save introspection result for development tools
    const introspectionPath = path.join(__dirname, '..', 'src', 'types', 'introspection-result.json');
    const introspectionDir = path.dirname(introspectionPath);
    if (!fs.existsSync(introspectionDir)) {
      fs.mkdirSync(introspectionDir, { recursive: true });
    }
    fs.writeFileSync(introspectionPath, JSON.stringify(result.data, null, 2), 'utf8');
    
    console.log(`✅ Schema extracted successfully!`);
    console.log(`   Schema file: ${schemaPath}`);
    console.log(`   Introspection: ${introspectionPath}`);
    console.log(`   Schema contains ${Object.keys(result.data.__schema.types).length} types`);
    
    return true;
    
  } catch (error) {
    console.error(`❌ Attempt ${retryCount + 1} failed:`, error.message);
    
    if (retryCount < CONFIG.maxRetries) {
      console.log(`⏳ Retrying in ${CONFIG.retryDelay / 1000} seconds...`);
      await sleep(CONFIG.retryDelay);
      return extractSchemaWithRetry(endpoint, retryCount + 1);
    }
    
    return false;
  }
}

/**
 * Create placeholder schema for development
 */
function createPlaceholderSchema() {
  console.log('📝 Creating placeholder schema for development...');
  
  const placeholderSchema = `# Placeholder GraphQL Schema
# This is a minimal schema used when the backend server is not available.
# Start the backend server and run "npm run codegen" to generate real types.

scalar DateTime
scalar Upload
scalar JSON

type Query {
  _empty: String
}

type Mutation {
  _empty: String
}

type Subscription {
  _empty: String
}

# Basic types for development
type User {
  id: ID!
  email: String!
  role: UserRole!
  createdAt: DateTime!
}

enum UserRole {
  STUDENT
  EDUCATOR
  ADMIN
}

type Course {
  id: ID!
  title: String!
  description: String!
  status: CourseStatus!
  createdAt: DateTime!
}

enum CourseStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
`;
  
  const schemaPath = path.join(__dirname, '..', 'schema.graphql');
  fs.writeFileSync(schemaPath, placeholderSchema, 'utf8');
  
  // Create minimal introspection result
  const minimalIntrospection = {
    __schema: {
      types: [],
      queryType: { name: 'Query' },
      mutationType: { name: 'Mutation' },
      subscriptionType: { name: 'Subscription' },
      directives: []
    }
  };
  
  const introspectionPath = path.join(__dirname, '..', 'src', 'types', 'introspection-result.json');
  const introspectionDir = path.dirname(introspectionPath);
  if (!fs.existsSync(introspectionDir)) {
    fs.mkdirSync(introspectionDir, { recursive: true });
  }
  fs.writeFileSync(introspectionPath, JSON.stringify(minimalIntrospection, null, 2), 'utf8');
  
  console.log(`📄 Placeholder schema created: ${schemaPath}`);
  console.log('💡 To generate real types:');
  console.log('   1. Start the backend server');
  console.log('   2. Run "npm run codegen"');
}

/**
 * Main extraction function
 */
async function extractSchema() {
  const endpoint = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';
  
  console.log('🚀 GraphQL Schema Extraction Starting...');
  console.log(`📡 Target endpoint: ${endpoint}`);
  
  const success = await extractSchemaWithRetry(endpoint);
  
  if (!success) {
    console.log('\n⚠️  Could not extract schema from server.');
    createPlaceholderSchema();
    
    // Exit with code 0 to not break the build process
    process.exit(0);
  }
  
  console.log('\n✨ Schema extraction completed successfully!');
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  createPlaceholderSchema();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  createPlaceholderSchema();
  process.exit(0);
});

extractSchema();