#!/usr/bin/env node

/**
 * Automated Schema Synchronization Workflow
 * 
 * This script provides an automated workflow for synchronizing the GraphQL schema
 * from the backend server, validating it, and regenerating TypeScript types.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { extractSchema } = require('./extract-schema.js');
const { validateSchema } = require('./validate-schema.js');

// Configuration
const CONFIG_FILE = path.join(__dirname, '..', 'schema-sync.config.json');
const LOCK_FILE = path.join(__dirname, '..', '.schema-sync.lock');

/**
 * Default configuration for schema synchronization
 */
const DEFAULT_CONFIG = {
  autoSync: false,
  validateBeforeCodegen: true,
  backupOnChanges: true,
  notifyOnBreakingChanges: true,
  retryAttempts: 3,
  retryDelay: 5000,
  healthCheckThreshold: 60,
  endpoints: {
    development: 'http://localhost:3000/graphql',
    staging: 'https://api-staging.example.com/graphql',
    production: 'https://api.example.com/graphql',
  },
};

/**
 * Loads configuration from file or creates default
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return { ...DEFAULT_CONFIG, ...config };
    } else {
      // Create default config file
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
      console.log(`📝 Created default configuration: ${CONFIG_FILE}`);
      return DEFAULT_CONFIG;
    }
  } catch (error) {
    console.warn('⚠️  Failed to load config, using defaults:', error.message);
    return DEFAULT_CONFIG;
  }
}

/**
 * Checks if another sync process is running
 */
function checkLock() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
      const lockAge = Date.now() - lockData.timestamp;
      
      // If lock is older than 10 minutes, consider it stale
      if (lockAge > 10 * 60 * 1000) {
        console.log('🔓 Removing stale lock file');
        fs.unlinkSync(LOCK_FILE);
        return false;
      }
      
      console.log('🔒 Another sync process is running, exiting...');
      return true;
    } catch (error) {
      // Invalid lock file, remove it
      fs.unlinkSync(LOCK_FILE);
      return false;
    }
  }
  return false;
}

/**
 * Creates a lock file to prevent concurrent syncs
 */
function createLock() {
  const lockData = {
    timestamp: Date.now(),
    pid: process.pid,
  };
  fs.writeFileSync(LOCK_FILE, JSON.stringify(lockData, null, 2), 'utf8');
}

/**
 * Removes the lock file
 */
function removeLock() {
  if (fs.existsSync(LOCK_FILE)) {
    fs.unlinkSync(LOCK_FILE);
  }
}

/**
 * Runs a command and returns a promise
 */
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`🔧 Running: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Waits for a specified amount of time
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Attempts to extract schema with retries
 */
async function extractSchemaWithRetry(config) {
  let lastError;
  
  for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
    try {
      console.log(`🔄 Schema extraction attempt ${attempt}/${config.retryAttempts}`);
      
      const result = await extractSchema();
      
      if (result.success) {
        console.log('✅ Schema extraction successful');
        return result;
      } else {
        throw new Error('Schema extraction failed');
      }
      
    } catch (error) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      if (attempt < config.retryAttempts) {
        console.log(`⏳ Waiting ${config.retryDelay}ms before retry...`);
        await delay(config.retryDelay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Validates schema and checks health
 */
async function validateSchemaHealth(config) {
  console.log('🔍 Validating schema health...');
  
  try {
    const result = await validateSchema();
    
    if (!result.success) {
      console.warn('⚠️  Schema validation completed with issues');
    }
    
    const healthScore = result.report.health.score;
    
    if (healthScore < config.healthCheckThreshold) {
      console.warn(`⚠️  Schema health score (${healthScore}) below threshold (${config.healthCheckThreshold})`);
      
      if (config.notifyOnBreakingChanges) {
        console.log('📧 Health check notification would be sent here');
        // TODO: Implement notification system (email, Slack, etc.)
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Schema validation failed:', error.message);
    throw error;
  }
}

/**
 * Runs code generation
 */
async function runCodeGeneration() {
  console.log('🔧 Running GraphQL code generation...');
  
  try {
    await runCommand('npm', ['run', 'codegen:generate'], {
      cwd: path.join(__dirname, '..'),
    });
    
    console.log('✅ Code generation completed');
    
  } catch (error) {
    console.error('❌ Code generation failed:', error.message);
    throw error;
  }
}

/**
 * Main synchronization workflow
 */
async function syncSchema(options = {}) {
  const config = loadConfig();
  const startTime = Date.now();
  
  console.log('🚀 Starting automated schema synchronization...\n');
  
  // Check for concurrent processes
  if (checkLock()) {
    return { success: false, error: 'Another sync process is running' };
  }
  
  // Create lock file
  createLock();
  
  try {
    // Step 1: Extract schema from backend
    console.log('📡 Step 1: Extracting schema from backend...');
    const extractionResult = await extractSchemaWithRetry(config);
    
    // Step 2: Validate schema if enabled
    let validationResult;
    if (config.validateBeforeCodegen) {
      console.log('\n🔍 Step 2: Validating schema...');
      validationResult = await validateSchemaHealth(config);
      
      // Stop if validation fails critically
      if (!validationResult.success && validationResult.report.summary.overall === 'FAIL') {
        throw new Error('Schema validation failed critically');
      }
    }
    
    // Step 3: Run code generation
    console.log('\n⚙️  Step 3: Generating TypeScript types...');
    await runCodeGeneration();
    
    // Step 4: Final summary
    const duration = Date.now() - startTime;
    console.log('\n🎉 Schema synchronization completed successfully!');
    console.log(`   ⏱️  Duration: ${Math.round(duration / 1000)}s`);
    
    if (extractionResult.hasChanges) {
      console.log('   📝 Schema changes detected and processed');
    } else {
      console.log('   ✨ No schema changes detected');
    }
    
    if (validationResult) {
      console.log(`   🏥 Health Score: ${validationResult.report.health.score}/100`);
    }
    
    return {
      success: true,
      duration,
      hasChanges: extractionResult.hasChanges,
      healthScore: validationResult?.report.health.score,
      stats: extractionResult.stats,
    };
    
  } catch (error) {
    console.error('\n💥 Schema synchronization failed:', error.message);
    
    // Try to restore from backup if available
    const backupPath = path.join(__dirname, '..', 'schema.backup.graphql');
    if (fs.existsSync(backupPath)) {
      console.log('🔄 Attempting to restore from backup...');
      try {
        const schemaPath = path.join(__dirname, '..', 'schema.graphql');
        fs.copyFileSync(backupPath, schemaPath);
        console.log('✅ Schema restored from backup');
      } catch (restoreError) {
        console.error('❌ Failed to restore from backup:', restoreError.message);
      }
    }
    
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime,
    };
    
  } finally {
    // Always remove lock file
    removeLock();
  }
}

/**
 * Watch mode for continuous synchronization
 */
async function watchMode(config) {
  console.log('👀 Starting schema watch mode...');
  console.log('   Press Ctrl+C to stop watching\n');
  
  const watchInterval = config.watchInterval || 30000; // 30 seconds default
  
  while (true) {
    try {
      const result = await syncSchema();
      
      if (result.hasChanges) {
        console.log('🔄 Schema changes detected and synchronized');
      }
      
    } catch (error) {
      console.error('❌ Watch sync failed:', error.message);
    }
    
    console.log(`⏳ Waiting ${watchInterval / 1000}s before next check...`);
    await delay(watchInterval);
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'sync';
  
  try {
    switch (command) {
      case 'sync':
        await syncSchema();
        break;
        
      case 'watch':
        const config = loadConfig();
        await watchMode(config);
        break;
        
      case 'config':
        const configPath = CONFIG_FILE;
        console.log(`📝 Configuration file: ${configPath}`);
        if (fs.existsSync(configPath)) {
          console.log(fs.readFileSync(configPath, 'utf8'));
        } else {
          console.log('No configuration file found. Run sync to create default config.');
        }
        break;
        
      case 'status':
        const lockExists = fs.existsSync(LOCK_FILE);
        console.log(`🔒 Lock file: ${lockExists ? 'EXISTS' : 'NOT FOUND'}`);
        
        const schemaExists = fs.existsSync(path.join(__dirname, '..', 'schema.graphql'));
        console.log(`📄 Schema file: ${schemaExists ? 'EXISTS' : 'NOT FOUND'}`);
        
        if (schemaExists) {
          const metadataPath = path.join(__dirname, '..', 'schema-metadata.json');
          if (fs.existsSync(metadataPath)) {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            console.log(`📊 Last extraction: ${metadata.extractedAt}`);
            console.log(`📊 Stats: ${JSON.stringify(metadata.stats, null, 2)}`);
          }
        }
        break;
        
      default:
        console.log('Usage: node sync-schema.js [command]');
        console.log('Commands:');
        console.log('  sync    - Run one-time schema synchronization (default)');
        console.log('  watch   - Run continuous schema synchronization');
        console.log('  config  - Show current configuration');
        console.log('  status  - Show synchronization status');
        break;
    }
    
  } catch (error) {
    console.error('💥 Command failed:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, cleaning up...');
  removeLock();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, cleaning up...');
  removeLock();
  process.exit(0);
});

// Run CLI if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { syncSchema, loadConfig };