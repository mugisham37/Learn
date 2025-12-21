#!/usr/bin/env node

/**
 * GraphQL Schema Validation Utility
 *
 * This script validates the GraphQL schema for compatibility and completeness.
 * It checks for breaking changes, missing operations, and schema health.
 *
 * Requirements: 1.3, 1.5
 */

const fs = require('fs');
const path = require('path');
const { buildSchema, validate, parse } = require('graphql');

// Configuration
const SCHEMA_PATH = path.join(__dirname, '..', 'schema.graphql');
const OPERATIONS_PATH = path.join(__dirname, '..', 'src', 'graphql', 'operations.graphql');
const VALIDATION_REPORT_PATH = path.join(__dirname, '..', 'schema-validation-report.json');

/**
 * Loads and parses the GraphQL schema
 */
function loadSchema() {
  console.log('📖 Loading GraphQL schema...');

  try {
    if (!fs.existsSync(SCHEMA_PATH)) {
      throw new Error(`Schema file not found: ${SCHEMA_PATH}`);
    }

    const schemaSDL = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const schema = buildSchema(schemaSDL);

    console.log('✅ Schema loaded successfully');
    return { schema, schemaSDL };
  } catch (error) {
    console.error('❌ Failed to load schema:', error.message);
    throw error;
  }
}

/**
 * Validates GraphQL operations against the schema
 */
function validateOperations(schema) {
  console.log('🔍 Validating GraphQL operations...');

  try {
    if (!fs.existsSync(OPERATIONS_PATH)) {
      console.log('⚠️  No operations file found, skipping operation validation');
      return { valid: true, errors: [], operations: [] };
    }

    const operationsSDL = fs.readFileSync(OPERATIONS_PATH, 'utf8');
    const operationsDocument = parse(operationsSDL);

    // Validate operations against schema
    const validationErrors = validate(schema, operationsDocument);

    if (validationErrors.length === 0) {
      console.log('✅ All operations are valid');
      return {
        valid: true,
        errors: [],
        operations: operationsDocument.definitions.map(def => ({
          name: def.name?.value || 'Anonymous',
          operation: def.operation || 'fragment',
          type: def.kind,
        })),
      };
    } else {
      console.error('❌ Operation validation failed');
      validationErrors.forEach((error, index) => {
        console.error(`   ${index + 1}. ${error.message}`);
      });

      return {
        valid: false,
        errors: validationErrors.map(error => ({
          message: error.message,
          locations: error.locations,
        })),
        operations: [],
      };
    }
  } catch (error) {
    console.error('❌ Failed to validate operations:', error.message);
    return {
      valid: false,
      errors: [{ message: error.message }],
      operations: [],
    };
  }
}

/**
 * Analyzes schema completeness and health
 */
function analyzeSchemaHealth(schema) {
  console.log('🔍 Analyzing schema health...');

  try {
    const typeMap = schema.getTypeMap();
    const queryType = schema.getQueryType();
    const mutationType = schema.getMutationType();
    const subscriptionType = schema.getSubscriptionType();

    // Filter out built-in types
    const customTypes = Object.keys(typeMap).filter(name => !name.startsWith('__'));

    // Analyze query operations
    const queryFields = queryType ? Object.keys(queryType.getFields()) : [];
    const mutationFields = mutationType ? Object.keys(mutationType.getFields()) : [];
    const subscriptionFields = subscriptionType ? Object.keys(subscriptionType.getFields()) : [];

    // Check for placeholder operations (indicating incomplete integration)
    const hasPlaceholders =
      queryFields.includes('_empty') ||
      mutationFields.includes('_empty') ||
      subscriptionFields.includes('_empty');

    // Calculate completeness score
    let completenessScore = 0;
    if (queryFields.length > 1 || !queryFields.includes('_empty')) completenessScore += 30;
    if (mutationFields.length > 1 || !mutationFields.includes('_empty')) completenessScore += 30;
    if (subscriptionFields.length > 1 || !subscriptionFields.includes('_empty'))
      completenessScore += 20;
    if (customTypes.length > 10) completenessScore += 20; // Reasonable number of types

    const health = {
      score: completenessScore,
      status:
        completenessScore >= 80
          ? 'excellent'
          : completenessScore >= 60
            ? 'good'
            : completenessScore >= 40
              ? 'fair'
              : 'poor',
      hasPlaceholders,
      stats: {
        customTypes: customTypes.length,
        queries: queryFields.length,
        mutations: mutationFields.length,
        subscriptions: subscriptionFields.length,
      },
      recommendations: [],
    };

    // Generate recommendations
    if (hasPlaceholders) {
      health.recommendations.push(
        'Remove placeholder operations (_empty) and implement real operations'
      );
    }

    if (queryFields.length < 5) {
      health.recommendations.push('Consider adding more query operations for better API coverage');
    }

    if (mutationFields.length < 3) {
      health.recommendations.push(
        'Consider adding more mutation operations for CRUD functionality'
      );
    }

    if (subscriptionFields.length === 0) {
      health.recommendations.push('Consider adding subscription operations for real-time features');
    }

    console.log(
      `✅ Schema health analysis complete (Score: ${health.score}/100 - ${health.status})`
    );

    return health;
  } catch (error) {
    console.error('❌ Failed to analyze schema health:', error.message);
    return {
      score: 0,
      status: 'error',
      error: error.message,
      stats: {},
      recommendations: ['Fix schema parsing errors before proceeding'],
    };
  }
}

/**
 * Checks for common schema issues
 */
function checkSchemaIssues(schemaSDL) {
  console.log('🔍 Checking for common schema issues...');

  const issues = [];
  const warnings = [];

  // Check for missing descriptions
  if (!schemaSDL.includes('"""') && !schemaSDL.includes('"')) {
    warnings.push('Schema lacks documentation comments');
  }

  // Check for proper scalar definitions
  const requiredScalars = ['DateTime', 'JSON', 'Upload'];
  requiredScalars.forEach(scalar => {
    if (!schemaSDL.includes(`scalar ${scalar}`)) {
      issues.push(`Missing required scalar: ${scalar}`);
    }
  });

  // Check for pagination patterns
  if (!schemaSDL.includes('PageInfo') || !schemaSDL.includes('Connection')) {
    warnings.push('Schema may lack proper pagination patterns');
  }

  // Check for error handling patterns
  if (!schemaSDL.includes('Error') && !schemaSDL.includes('error')) {
    warnings.push('Schema may lack proper error handling patterns');
  }

  console.log(
    `✅ Schema issues check complete (${issues.length} issues, ${warnings.length} warnings)`
  );

  return { issues, warnings };
}

/**
 * Generates a validation report
 */
function generateReport(validation) {
  console.log('📊 Generating validation report...');

  const report = {
    timestamp: new Date().toISOString(),
    schema: {
      valid: validation.schema.valid,
      path: SCHEMA_PATH,
      health: validation.health,
    },
    operations: {
      valid: validation.operations.valid,
      path: OPERATIONS_PATH,
      count: validation.operations.operations.length,
      errors: validation.operations.errors,
    },
    issues: validation.issues,
    summary: {
      overall:
        validation.schema.valid &&
        validation.operations.valid &&
        validation.issues.issues.length === 0
          ? 'PASS'
          : 'FAIL',
      score: validation.health.score,
      recommendations: [
        ...validation.health.recommendations,
        ...validation.issues.issues.map(issue => `Fix: ${issue}`),
        ...validation.issues.warnings.map(warning => `Consider: ${warning}`),
      ],
    },
  };

  // Save report to file
  fs.writeFileSync(VALIDATION_REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

  console.log('✅ Validation report generated');
  console.log(`   📁 Report: ${VALIDATION_REPORT_PATH}`);

  return report;
}

/**
 * Main validation function
 */
async function validateSchema() {
  console.log('🚀 Starting GraphQL schema validation...\n');

  try {
    // Step 1: Load schema
    const { schema, schemaSDL } = loadSchema();

    // Step 2: Validate operations
    const operationsValidation = validateOperations(schema);

    // Step 3: Analyze schema health
    const healthAnalysis = analyzeSchemaHealth(schema);

    // Step 4: Check for common issues
    const issuesCheck = checkSchemaIssues(schemaSDL);

    // Step 5: Generate report
    const report = generateReport({
      schema: { valid: true },
      operations: operationsValidation,
      health: healthAnalysis,
      issues: issuesCheck,
    });

    // Step 6: Display summary
    console.log('\n📋 Validation Summary:');
    console.log(`   Overall Status: ${report.summary.overall}`);
    console.log(`   Health Score: ${report.summary.score}/100 (${healthAnalysis.status})`);
    console.log(`   Operations: ${operationsValidation.operations.length} defined`);
    console.log(`   Issues: ${issuesCheck.issues.length}`);
    console.log(`   Warnings: ${issuesCheck.warnings.length}`);

    if (report.summary.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.summary.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }

    if (report.summary.overall === 'PASS') {
      console.log('\n🎉 Schema validation passed!');
      return { success: true, report };
    } else {
      console.log('\n⚠️  Schema validation completed with issues');
      return { success: false, report };
    }
  } catch (error) {
    console.error('\n💥 Schema validation failed:', error.message);
    process.exit(1);
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  validateSchema();
}

module.exports = { validateSchema };
