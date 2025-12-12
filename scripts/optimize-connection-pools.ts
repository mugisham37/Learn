#!/usr/bin/env tsx

/**
 * Connection Pool Optimization Script
 * 
 * Runs load tests to determine optimal connection pool configurations
 * and provides recommendations for production settings.
 * 
 * Usage:
 *   npm run optimize-pools
 *   npm run optimize-pools -- --preset heavy
 *   npm run optimize-pools -- --concurrent 50 --duration 60000
 */

import { Command } from 'commander';
import { initializeDatabasePools, getWritePool, getReadPool, getConnectionMonitor, closeDatabaseConnection } from '../src/infrastructure/database/index.js';
import { DatabaseLoadTester, LoadTestPresets, LoadTestConfig } from '../src/infrastructure/database/LoadTester.js';
import { validateConfig } from '../src/config/index.js';

interface OptimizationResult {
  currentConfig: {
    writePoolMax: number;
    readPoolMax: number;
    usePgBouncer: boolean;
  };
  testResults: any[];
  recommendations: {
    optimalWritePoolSize: number;
    optimalReadPoolSize: number;
    recommendPgBouncer: boolean;
    reasoning: string[];
  };
}

async function runOptimizationTest(config: LoadTestConfig): Promise<any> {
  console.log(`\n🔄 Running load test: ${config.concurrentConnections} connections, ${config.testDurationMs}ms duration`);
  
  const writePool = getWritePool();
  const readPool = getReadPool();
  const loadTester = new DatabaseLoadTester(writePool, readPool);
  
  const result = await loadTester.runLoadTest(config);
  
  console.log(`✅ Test completed:`);
  console.log(`   - Total queries: ${result.totalQueries}`);
  console.log(`   - QPS: ${result.queriesPerSecond.toFixed(2)}`);
  console.log(`   - Success rate: ${((result.successfulQueries / result.totalQueries) * 100).toFixed(1)}%`);
  console.log(`   - Avg query time: ${result.averageQueryTime.toFixed(2)}ms`);
  console.log(`   - Peak pool utilization: ${result.peakPoolUtilization.toFixed(1)}%`);
  
  if (result.recommendations.length > 0) {
    console.log(`   - Recommendations:`);
    result.recommendations.forEach(rec => console.log(`     • ${rec}`));
  }
  
  return result;
}

async function runStressTest(): Promise<any> {
  console.log(`\n🔥 Running stress test...`);
  
  const writePool = getWritePool();
  const readPool = getReadPool();
  const loadTester = new DatabaseLoadTester(writePool, readPool);
  
  const result = await loadTester.quickStressTest();
  
  console.log(`✅ Stress test completed:`);
  console.log(`   - Max concurrent connections: ${result.maxConcurrentConnections}`);
  console.log(`   - Connection establishment time: ${result.connectionEstablishmentTime.toFixed(2)}ms`);
  console.log(`   - Pool exhaustion point: ${result.poolExhaustionPoint}`);
  
  return result;
}

function analyzeResults(testResults: any[]): OptimizationResult['recommendations'] {
  const recommendations = {
    optimalWritePoolSize: 20,
    optimalReadPoolSize: 15,
    recommendPgBouncer: false,
    reasoning: [] as string[],
  };
  
  // Analyze peak utilization across all tests
  const peakUtilizations = testResults.map(r => r.peakPoolUtilization);
  const avgPeakUtilization = peakUtilizations.reduce((sum, util) => sum + util, 0) / peakUtilizations.length;
  
  // Analyze failure rates
  const failureRates = testResults.map(r => r.failedQueries / r.totalQueries);
  const maxFailureRate = Math.max(...failureRates);
  
  // Analyze connection timeouts
  const totalTimeouts = testResults.reduce((sum, r) => sum + r.connectionTimeouts, 0);
  
  // Determine optimal pool sizes
  if (avgPeakUtilization > 85) {
    recommendations.optimalWritePoolSize = Math.ceil(recommendations.optimalWritePoolSize * 1.5);
    recommendations.optimalReadPoolSize = Math.ceil(recommendations.optimalReadPoolSize * 1.5);
    recommendations.reasoning.push('High peak utilization detected - increasing pool sizes');
  }
  
  if (maxFailureRate > 0.05) {
    recommendations.optimalWritePoolSize = Math.ceil(recommendations.optimalWritePoolSize * 1.3);
    recommendations.reasoning.push('High failure rate detected - increasing pool sizes');
  }
  
  if (totalTimeouts > 10) {
    recommendations.recommendPgBouncer = true;
    recommendations.reasoning.push('Connection timeouts detected - PgBouncer recommended for better connection management');
  }
  
  // Check if current performance is good
  if (avgPeakUtilization < 70 && maxFailureRate < 0.01 && totalTimeouts === 0) {
    recommendations.reasoning.push('Current configuration performs well under tested loads');
  }
  
  // PgBouncer recommendation logic
  const maxConcurrentConnections = Math.max(...testResults.map(r => r.config.concurrentConnections));
  if (maxConcurrentConnections > 50) {
    recommendations.recommendPgBouncer = true;
    recommendations.reasoning.push('High concurrency detected - PgBouncer recommended for connection pooling');
  }
  
  return recommendations;
}

async function generateReport(results: OptimizationResult): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = `logs/connection-pool-optimization-${timestamp}.json`;
  
  // Write detailed report
  const fs = await import('fs/promises');
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  
  console.log(`\n📊 Optimization Report Generated: ${reportPath}`);
  console.log(`\n🎯 Recommendations:`);
  console.log(`   - Optimal Write Pool Size: ${results.recommendations.optimalWritePoolSize}`);
  console.log(`   - Optimal Read Pool Size: ${results.recommendations.optimalReadPoolSize}`);
  console.log(`   - PgBouncer Recommended: ${results.recommendations.recommendPgBouncer ? 'Yes' : 'No'}`);
  
  console.log(`\n💡 Reasoning:`);
  results.recommendations.reasoning.forEach(reason => {
    console.log(`   • ${reason}`);
  });
  
  console.log(`\n⚙️  Suggested Environment Variables:`);
  console.log(`   DATABASE_POOL_MAX=${results.recommendations.optimalWritePoolSize + results.recommendations.optimalReadPoolSize}`);
  console.log(`   USE_PGBOUNCER=${results.recommendations.recommendPgBouncer}`);
  
  if (results.recommendations.recommendPgBouncer) {
    console.log(`   PGBOUNCER_URL=postgresql://postgres:password@localhost:6432/learning_platform`);
  }
}

async function main() {
  const program = new Command();
  
  program
    .name('optimize-connection-pools')
    .description('Optimize database connection pool configuration through load testing')
    .option('-p, --preset <preset>', 'Use predefined test preset (light, medium, heavy)', 'medium')
    .option('-c, --concurrent <number>', 'Number of concurrent connections', '50')
    .option('-d, --duration <number>', 'Test duration in milliseconds', '60000')
    .option('-s, --stress', 'Run stress test only')
    .option('--all', 'Run all test presets')
    .parse();
  
  const options = program.opts();
  
  try {
    // Validate configuration
    validateConfig();
    
    // Initialize database
    console.log('🚀 Initializing database connection pools...');
    await initializeDatabasePools();
    
    const writePool = getWritePool();
    const readPool = getReadPool();
    
    const currentConfig = {
      writePoolMax: writePool.options.max || 20,
      readPoolMax: readPool.options.max || 15,
      usePgBouncer: process.env.USE_PGBOUNCER === 'true',
    };
    
    console.log(`📋 Current Configuration:`);
    console.log(`   - Write Pool Max: ${currentConfig.writePoolMax}`);
    console.log(`   - Read Pool Max: ${currentConfig.readPoolMax}`);
    console.log(`   - PgBouncer: ${currentConfig.usePgBouncer ? 'Enabled' : 'Disabled'}`);
    
    const testResults: any[] = [];
    
    if (options.stress) {
      // Run stress test only
      const stressResult = await runStressTest();
      testResults.push(stressResult);
    } else if (options.all) {
      // Run all presets
      for (const [presetName, preset] of Object.entries(LoadTestPresets)) {
        console.log(`\n📊 Running ${presetName} preset...`);
        const result = await runOptimizationTest(preset);
        testResults.push(result);
        
        // Wait between tests
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } else if (options.preset && LoadTestPresets[options.preset as keyof typeof LoadTestPresets]) {
      // Run specific preset
      const preset = LoadTestPresets[options.preset as keyof typeof LoadTestPresets];
      const result = await runOptimizationTest(preset);
      testResults.push(result);
    } else {
      // Run custom configuration
      const customConfig: LoadTestConfig = {
        concurrentConnections: parseInt(options.concurrent),
        testDurationMs: parseInt(options.duration),
        queryInterval: 50,
        readQueries: LoadTestPresets.medium.readQueries,
        writeQueries: LoadTestPresets.medium.writeQueries,
        readWriteRatio: 0.7,
        sampleInterval: 1000,
      };
      
      const result = await runOptimizationTest(customConfig);
      testResults.push(result);
    }
    
    // Analyze results and generate recommendations
    const recommendations = analyzeResults(testResults);
    
    const optimizationResult: OptimizationResult = {
      currentConfig,
      testResults,
      recommendations,
    };
    
    // Generate report
    await generateReport(optimizationResult);
    
    // Show connection monitor summary
    const monitor = getConnectionMonitor();
    const analysis = monitor.analyzeConnectionPools();
    
    console.log(`\n📈 Connection Pool Analysis:`);
    console.log(`   Write Pool - Avg Utilization: ${analysis.write.averageUtilization.toFixed(1)}%, Peak: ${analysis.write.peakUtilization.toFixed(1)}%`);
    console.log(`   Read Pool - Avg Utilization: ${analysis.read.averageUtilization.toFixed(1)}%, Peak: ${analysis.read.peakUtilization.toFixed(1)}%`);
    
    console.log(`\n✅ Optimization complete!`);
    
  } catch (error) {
    console.error('❌ Optimization failed:', error);
    process.exit(1);
  } finally {
    // Clean up
    await closeDatabaseConnection();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await closeDatabaseConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await closeDatabaseConnection();
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}