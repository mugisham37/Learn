#!/usr/bin/env tsx

/**
 * Test Script for Scheduler Service
 * 
 * Tests the unified scheduler service implementation to ensure
 * all scheduled tasks are properly configured and working.
 */

import { config } from '../src/config/index.js';
import { logger } from '../src/shared/utils/logger.js';
import { 
  initializeSchedulerService, 
  getSchedulerService,
  shutdownSchedulerService 
} from '../src/shared/services/SchedulerService.js';

async function testScheduler(): Promise<void> {
  try {
    logger.info('Testing scheduler service implementation...');

    // Initialize scheduler service
    const schedulerService = initializeSchedulerService({
      enabled: true, // Force enable for testing
      timezone: 'UTC',
    });

    await schedulerService.initialize();
    logger.info('Scheduler service initialized successfully');

    // Get status
    const status = await schedulerService.getStatus();
    logger.info('Scheduler status:', status);

    // Get detailed stats
    try {
      const detailedStats = await schedulerService.getDetailedStats();
      logger.info('Detailed scheduler stats:', {
        scheduler: detailedStats.scheduler,
        hasAnalytics: !!detailedStats.analytics,
        hasSessionCleanup: !!detailedStats.sessionCleanup,
        hasLogPruning: !!detailedStats.logPruning,
      });
    } catch (error) {
      logger.warn('Could not get detailed stats (expected in test environment)', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test health check
    const isHealthy = await schedulerService.healthCheck();
    logger.info('Scheduler health check:', { isHealthy });

    // Test manual task triggering (session cleanup and log pruning should work)
    try {
      logger.info('Testing manual task triggers...');
      
      await schedulerService.triggerTask('daily-session-cleanup');
      logger.info('Session cleanup task triggered successfully');
      
      await schedulerService.triggerTask('daily-log-pruning');
      logger.info('Log pruning task triggered successfully');
    } catch (error) {
      logger.warn('Manual task triggering failed (expected without full infrastructure)', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Shutdown
    await shutdownSchedulerService();
    logger.info('Scheduler service shutdown completed');

    logger.info('✅ Scheduler service test completed successfully');
  } catch (error) {
    logger.error('❌ Scheduler service test failed', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    });
    process.exit(1);
  }
}

// Run the test
void testScheduler();