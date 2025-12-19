/**
 * GraphQL Schema Extraction Script
 * 
 * Extracts the GraphQL schema from the running server for code generation.
 * This script will be used by the codegen process.
 */

const fs = require('fs');
const path = require('path');
const { buildClientSchema, getIntrospectionQuery, printSchema } = require('graphql');

async function extractSchema() {
  try {
    const endpoint = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';
    
    console.log(`Extracting schema from: ${endpoint}`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: getIntrospectionQuery(),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    const schema = buildClientSchema(result.data);
    const schemaString = printSchema(schema);
    
    // Write schema to file
    const schemaPath = path.join(__dirname, '..', 'schema.graphql');
    fs.writeFileSync(schemaPath, schemaString);
    
    console.log(`Schema extracted successfully to: ${schemaPath}`);
    
  } catch (error) {
    console.error('Failed to extract schema:', error.message);
    
    // If server is not running, create a placeholder schema
    console.log('Creating placeholder schema for development...');
    
    const placeholderSchema = `
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
    `;
    
    const schemaPath = path.join(__dirname, '..', 'schema.graphql');
    fs.writeFileSync(schemaPath, placeholderSchema);
    
    console.log('Placeholder schema created. Start the server and run "npm run codegen" to generate real types.');
  }
}

extractSchema();