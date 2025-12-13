/**
 * Database Load Tester
 *
 * Utility for load testing database connection pools to optimize pool sizes
 * and identify bottlenecks under various load conditions.
 *
 * Requirements: 15.7
 */

import { performance } from 'perf_hooks';

import { Pool } from 'pg';

export interface LoadTestConfig {
  // Test parameters
  concurrentConnections: number;
  testDurationMs: number;
  queryInterval: number; // Milliseconds between queries per connection

  // Query types to test
  readQueries: string[];
  writeQueries: string[];
  readWriteRatio: number; // 0.7 = 70% reads, 30% writes

  // Monitoring
  sampleInterval: number; // How often to collect metrics (ms)
}

export interface LoadTestResult {
  config: LoadTestConfig;
  startTime: Date;
  endTime: Date;
  durationMs: number;

  // Performance metrics
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  queriesPerSecond: number;

  // Timing metrics
  averageQueryTime: number;
  medianQueryTime: number;
  p95QueryTime: number;
  p99QueryTime: number;
  maxQueryTime: number;

  // Connection metrics
  averagePoolUtilization: number;
  peakPoolUtilization: number;
  averageWaitingClients: number;
  peakWaitingClients: number;
  connectionTimeouts: number;

  // Error analysis
  errors: Array<{
    timestamp: Date;
    error: string;
    queryType: 'read' | 'write';
  }>;

  // Recommendations
  recommendations: string[];
}

export class DatabaseLoadTester {
  private writePool: Pool;
  private readPool: Pool;

  constructor(writePool: Pool, readPool: Pool) {
    this.writePool = writePool;
    this.readPool = readPool;
  }

  /**
   * Run a comprehensive load test
   */
  public async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    console.log(
      `Starting load test with ${config.concurrentConnections} concurrent connections for ${config.testDurationMs}ms`
    );

    const result: LoadTestResult = {
      config,
      startTime: new Date(),
      endTime: new Date(),
      durationMs: 0,
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      queriesPerSecond: 0,
      averageQueryTime: 0,
      medianQueryTime: 0,
      p95QueryTime: 0,
      p99QueryTime: 0,
      maxQueryTime: 0,
      averagePoolUtilization: 0,
      peakPoolUtilization: 0,
      averageWaitingClients: 0,
      peakWaitingClients: 0,
      connectionTimeouts: 0,
      errors: [],
      recommendations: [],
    };

    // Metrics collection
    const queryTimes: number[] = [];
    const poolMetrics: Array<{
      timestamp: number;
      writeUtilization: number;
      readUtilization: number;
      writeWaiting: number;
      readWaiting: number;
    }> = [];

    // Start metrics collection
    const metricsInterval = setInterval(() => {
      const writeUtilization =
        (this.writePool.totalCount / (this.writePool.options.max || 20)) * 100;
      const readUtilization = (this.readPool.totalCount / (this.readPool.options.max || 20)) * 100;

      poolMetrics.push({
        timestamp: Date.now(),
        writeUtilization,
        readUtilization,
        writeWaiting: this.writePool.waitingCount,
        readWaiting: this.readPool.waitingCount,
      });
    }, config.sampleInterval);

    // Create worker promises
    const workers = Array.from({ length: config.concurrentConnections }, (_, i) =>
      this.createWorker(i, config, result, queryTimes)
    );

    // Run the test
    const startTime = performance.now();
    await Promise.all(workers);
    const endTime = performance.now();

    // Stop metrics collection
    clearInterval(metricsInterval);

    // Calculate final results
    result.endTime = new Date();
    result.durationMs = endTime - startTime;
    result.queriesPerSecond = result.totalQueries / (result.durationMs / 1000);

    // Calculate timing percentiles
    if (queryTimes.length > 0) {
      queryTimes.sort((a, b) => a - b);
      result.averageQueryTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;
      result.medianQueryTime = queryTimes[Math.floor(queryTimes.length * 0.5)];
      result.p95QueryTime = queryTimes[Math.floor(queryTimes.length * 0.95)];
      result.p99QueryTime = queryTimes[Math.floor(queryTimes.length * 0.99)];
      result.maxQueryTime = queryTimes[queryTimes.length - 1];
    }

    // Calculate pool utilization metrics
    if (poolMetrics.length > 0) {
      const avgWriteUtil =
        poolMetrics.reduce((sum, m) => sum + m.writeUtilization, 0) / poolMetrics.length;
      const avgReadUtil =
        poolMetrics.reduce((sum, m) => sum + m.readUtilization, 0) / poolMetrics.length;
      result.averagePoolUtilization = (avgWriteUtil + avgReadUtil) / 2;

      result.peakPoolUtilization = Math.max(
        ...poolMetrics.map((m) => Math.max(m.writeUtilization, m.readUtilization))
      );

      const avgWriteWaiting =
        poolMetrics.reduce((sum, m) => sum + m.writeWaiting, 0) / poolMetrics.length;
      const avgReadWaiting =
        poolMetrics.reduce((sum, m) => sum + m.readWaiting, 0) / poolMetrics.length;
      result.averageWaitingClients = (avgWriteWaiting + avgReadWaiting) / 2;

      result.peakWaitingClients = Math.max(
        ...poolMetrics.map((m) => Math.max(m.writeWaiting, m.readWaiting))
      );
    }

    // Generate recommendations
    result.recommendations = this.generateRecommendations(result);

    console.log(
      `Load test completed: ${result.totalQueries} queries, ${result.queriesPerSecond.toFixed(2)} QPS, ${result.failedQueries} failures`
    );

    return result;
  }

  /**
   * Create a worker that executes queries continuously
   */
  private async createWorker(
    workerId: number,
    config: LoadTestConfig,
    result: LoadTestResult,
    queryTimes: number[]
  ): Promise<void> {
    const endTime = Date.now() + config.testDurationMs;

    while (Date.now() < endTime) {
      try {
        const isReadQuery = Math.random() < config.readWriteRatio;
        const queries = isReadQuery ? config.readQueries : config.writeQueries;
        const query = queries[Math.floor(Math.random() * queries.length)];
        const pool = isReadQuery ? this.readPool : this.writePool;

        const startTime = performance.now();

        try {
          const client = await pool.connect();
          try {
            await client.query(query);
            result.successfulQueries++;
          } finally {
            client.release();
          }

          const queryTime = performance.now() - startTime;
          queryTimes.push(queryTime);
        } catch (error) {
          result.failedQueries++;

          if (error instanceof Error && error.message.includes('timeout')) {
            result.connectionTimeouts++;
          }

          result.errors.push({
            timestamp: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error',
            queryType: isReadQuery ? 'read' : 'write',
          });
        }

        result.totalQueries++;

        // Wait before next query
        if (config.queryInterval > 0) {
          await new Promise((resolve) => setTimeout(resolve, config.queryInterval));
        }
      } catch (error) {
        console.error(`Worker ${workerId} error:`, error);
        break;
      }
    }
  }

  /**
   * Generate performance recommendations based on test results
   */
  private generateRecommendations(result: LoadTestResult): string[] {
    const recommendations: string[] = [];

    // High failure rate
    if (result.failedQueries / result.totalQueries > 0.05) {
      recommendations.push(
        `High failure rate (${((result.failedQueries / result.totalQueries) * 100).toFixed(1)}%) - consider increasing pool sizes or optimizing queries`
      );
    }

    // High pool utilization
    if (result.peakPoolUtilization > 90) {
      recommendations.push(
        `Peak pool utilization is ${result.peakPoolUtilization.toFixed(1)}% - consider increasing max pool size`
      );
    }

    // High average utilization
    if (result.averagePoolUtilization > 70) {
      recommendations.push(
        `Average pool utilization is ${result.averagePoolUtilization.toFixed(1)}% - monitor for sustained high load`
      );
    }

    // Connection timeouts
    if (result.connectionTimeouts > 0) {
      recommendations.push(
        `${result.connectionTimeouts} connection timeouts detected - increase pool size or connection timeout`
      );
    }

    // High waiting clients
    if (result.peakWaitingClients > 10) {
      recommendations.push(
        `Peak waiting clients: ${result.peakWaitingClients} - pool may be undersized for this load`
      );
    }

    // Slow queries
    if (result.p95QueryTime > 1000) {
      recommendations.push(
        `95th percentile query time is ${result.p95QueryTime.toFixed(0)}ms - investigate slow queries`
      );
    }

    // Low throughput
    const expectedQPS =
      result.config.concurrentConnections * (1000 / Math.max(result.config.queryInterval, 1));
    if (result.queriesPerSecond < expectedQPS * 0.8) {
      recommendations.push(
        `Actual QPS (${result.queriesPerSecond.toFixed(1)}) is below expected (${expectedQPS.toFixed(1)}) - check for bottlenecks`
      );
    }

    // Good performance
    if (recommendations.length === 0) {
      recommendations.push('Connection pools are performing well under this load');
    }

    return recommendations;
  }

  /**
   * Run a quick connection pool stress test
   */
  public async quickStressTest(): Promise<{
    maxConcurrentConnections: number;
    connectionEstablishmentTime: number;
    poolExhaustionPoint: number;
  }> {
    console.log('Running quick stress test...');

    const results = {
      maxConcurrentConnections: 0,
      connectionEstablishmentTime: 0,
      poolExhaustionPoint: 0,
    };

    // Test connection establishment time
    const startTime = performance.now();
    const client = await this.writePool.connect();
    results.connectionEstablishmentTime = performance.now() - startTime;
    client.release();

    // Test pool exhaustion point
    const connections: any[] = [];
    try {
      for (let i = 0; i < 100; i++) {
        const client = await Promise.race([
          this.writePool.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000)),
        ]);
        connections.push(client);
        results.maxConcurrentConnections = i + 1;
      }
    } catch (error) {
      results.poolExhaustionPoint = results.maxConcurrentConnections;
    } finally {
      // Release all connections
      connections.forEach((client) => client.release());
    }

    console.log(
      `Stress test completed: ${results.maxConcurrentConnections} max connections, ${results.connectionEstablishmentTime.toFixed(2)}ms establishment time`
    );

    return results;
  }
}

/**
 * Default load test configurations for different scenarios
 */
export const LoadTestPresets = {
  // Light load - typical application usage
  light: {
    concurrentConnections: 10,
    testDurationMs: 30000, // 30 seconds
    queryInterval: 100, // 100ms between queries
    readQueries: ['SELECT 1', 'SELECT COUNT(*) FROM users', 'SELECT * FROM courses LIMIT 10'],
    writeQueries: [
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      'INSERT INTO analytics_events (user_id, event_type, timestamp) VALUES ($1, $2, NOW())',
    ],
    readWriteRatio: 0.8, // 80% reads
    sampleInterval: 1000, // 1 second
  } as LoadTestConfig,

  // Medium load - busy application
  medium: {
    concurrentConnections: 50,
    testDurationMs: 60000, // 1 minute
    queryInterval: 50, // 50ms between queries
    readQueries: [
      'SELECT 1',
      'SELECT COUNT(*) FROM users',
      'SELECT * FROM courses LIMIT 10',
      'SELECT * FROM enrollments WHERE user_id = $1',
    ],
    writeQueries: [
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      'INSERT INTO analytics_events (user_id, event_type, timestamp) VALUES ($1, $2, NOW())',
      'UPDATE lesson_progress SET time_spent_seconds = time_spent_seconds + 60 WHERE id = $1',
    ],
    readWriteRatio: 0.7, // 70% reads
    sampleInterval: 500, // 0.5 seconds
  } as LoadTestConfig,

  // Heavy load - stress test
  heavy: {
    concurrentConnections: 100,
    testDurationMs: 120000, // 2 minutes
    queryInterval: 10, // 10ms between queries
    readQueries: [
      'SELECT 1',
      'SELECT COUNT(*) FROM users',
      'SELECT * FROM courses LIMIT 10',
      'SELECT * FROM enrollments WHERE user_id = $1',
      'SELECT * FROM lesson_progress WHERE enrollment_id = $1',
    ],
    writeQueries: [
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      'INSERT INTO analytics_events (user_id, event_type, timestamp) VALUES ($1, $2, NOW())',
      'UPDATE lesson_progress SET time_spent_seconds = time_spent_seconds + 60 WHERE id = $1',
      'INSERT INTO notifications (recipient_id, type, title, content) VALUES ($1, $2, $3, $4)',
    ],
    readWriteRatio: 0.6, // 60% reads
    sampleInterval: 250, // 0.25 seconds
  } as LoadTestConfig,
};
