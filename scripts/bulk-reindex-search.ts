#!/usr/bin/env tsx
/**
 * Bulk Search Reindexing Script
 * 
 * Command-line script for performing bulk reindexing of search indices.
 * Useful for initial data load, recovery from index corruption, or
 * after major schema changes.
 * 
 * Requirements: 8.7 - Implement bulk reindexing script for initial load
 * 
 * Usage:
 *   npm run reindex:search -- --type=all
 *   npm run reindex:search -- --type=courses --batch-size=50
 *   npm run reindex:search -- --type=lessons --start-from=course-123
 */

import { Command } from 'commander';
import { logger } from '../src/shared/utils/logger.js';
import { createSearchService } from '../src/modules/search/index.js';
import { SearchIndexingService } from '../src/modules/search/infrastructure/events/SearchIndexingService.js';

/**
 * Script configuration interface
 */
interface ReindexConfig {
  type: 'courses' | 'lessons' | 'all';
  batchSize: number;
  startFromId?: string;
  dryRun: boolean;
  verbose: boolean;
  skipHealthCheck: boolean;
}

/**
 * Main reindexing function
 */
async function performBulkReindex(config: ReindexConfig): Promise<void> {
  let searchService;
  let indexingService;

  try {
    logger.info('Starting bulk search reindexing', {
      type: config.type,
      batchSize: config.batchSize,
      startFromId: config.startFromId,
      dryRun: config.dryRun,
    });

    // Initialize search service
    logger.info('Initializing search service...');
    searchService = await createSearchService();

    // Initialize indexing service
    indexingService = new SearchIndexingService(searchService, {
      enableEventHandlers: false, // Disable event handlers for bulk operations
      enableBulkReindexing: true,
      bulkReindexBatchSize: config.batchSize,
    });

    await indexingService.initialize();

    // Health check (unless skipped)
    if (!config.skipHealthCheck) {
      logger.info('Performing health check...');
      const health = await indexingService.getHealth();
      
      if (!health.search.healthy) {
        logger.error('Search service is not healthy', {
          searchHealth: health.search,
        });
        
        if (!config.dryRun) {
          throw new Error('Search service is not healthy. Use --skip-health-check to bypass.');
        }
      }

      logger.info('Health check completed', {
        healthy: health.healthy,
        searchIndices: health.search.indices,
        statistics: health.search.statistics,
      });
    }

    // Get initial queue stats
    const initialStats = await indexingService.getQueueStats();
    logger.info('Initial queue statistics', initialStats);

    if (config.dryRun) {
      logger.info('DRY RUN: Would perform bulk reindexing with the following configuration:', {
        type: config.type,
        batchSize: config.batchSize,
        startFromId: config.startFromId,
      });
      return;
    }

    // Start bulk reindexing
    logger.info('Starting bulk reindexing operation...');
    
    await indexingService.bulkReindex(config.type, {
      batchSize: config.batchSize,
      startFromId: config.startFromId,
      priority: 1, // Highest priority for bulk operations
    });

    logger.info('Bulk reindexing job queued successfully');

    // Monitor progress if verbose mode is enabled
    if (config.verbose) {
      await monitorProgress(indexingService, 30000); // Check every 30 seconds
    } else {
      logger.info('Bulk reindexing job has been queued. Monitor progress through the application logs or admin interface.');
    }

    // Get final queue stats
    const finalStats = await indexingService.getQueueStats();
    logger.info('Final queue statistics', finalStats);

    logger.info('Bulk search reindexing completed successfully');
  } catch (error) {
    logger.error('Bulk search reindexing failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    process.exit(1);
  } finally {
    // Cleanup
    if (indexingService) {
      try {
        await indexingService.shutdown();
      } catch (error) {
        logger.warn('Error during indexing service shutdown', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }
}

/**
 * Monitors the progress of bulk reindexing operations
 */
async function monitorProgress(
  indexingService: SearchIndexingService,
  intervalMs: number = 30000
): Promise<void> {
  logger.info('Starting progress monitoring...');

  const startTime = Date.now();
  let lastStats = await indexingService.getQueueStats();

  const monitorInterval = setInterval(async () => {
    try {
      const currentStats = await indexingService.getQueueStats();
      const elapsedMs = Date.now() - startTime;
      const elapsedMinutes = Math.round(elapsedMs / 60000);

      logger.info('Reindexing progress update', {
        elapsedMinutes,
        waiting: currentStats.waiting,
        active: currentStats.active,
        completed: currentStats.completed,
        failed: currentStats.failed,
        completedSinceLastCheck: currentStats.completed - lastStats.completed,
        failedSinceLastCheck: currentStats.failed - lastStats.failed,
      });

      // Stop monitoring if no jobs are active or waiting
      if (currentStats.waiting === 0 && currentStats.active === 0) {
        clearInterval(monitorInterval);
        
        logger.info('Bulk reindexing monitoring completed', {
          totalElapsedMinutes: elapsedMinutes,
          totalCompleted: currentStats.completed,
          totalFailed: currentStats.failed,
        });
        
        return;
      }

      lastStats = currentStats;
    } catch (error) {
      logger.error('Error during progress monitoring', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, intervalMs);

  // Set a maximum monitoring time (4 hours)
  setTimeout(() => {
    clearInterval(monitorInterval);
    logger.warn('Progress monitoring stopped due to timeout (4 hours)');
  }, 4 * 60 * 60 * 1000);
}

/**
 * Validates the configuration
 */
function validateConfig(config: ReindexConfig): void {
  if (!['courses', 'lessons', 'all'].includes(config.type)) {
    throw new Error(`Invalid type: ${config.type}. Must be 'courses', 'lessons', or 'all'.`);
  }

  if (config.batchSize <= 0 || config.batchSize > 1000) {
    throw new Error(`Invalid batch size: ${config.batchSize}. Must be between 1 and 1000.`);
  }

  if (config.startFromId && typeof config.startFromId !== 'string') {
    throw new Error(`Invalid start-from ID: ${config.startFromId}. Must be a string.`);
  }
}

/**
 * Main script execution
 */
async function main(): Promise<void> {
  const program = new Command();

  program
    .name('bulk-reindex-search')
    .description('Bulk reindex search indices for courses and lessons')
    .version('1.0.0')
    .requiredOption(
      '-t, --type <type>',
      'Type of content to reindex: courses, lessons, or all',
      'all'
    )
    .option(
      '-b, --batch-size <size>',
      'Number of items to process in each batch',
      '100'
    )
    .option(
      '-s, --start-from <id>',
      'ID to start reindexing from (for resuming interrupted operations)'
    )
    .option(
      '-d, --dry-run',
      'Perform a dry run without actually reindexing',
      false
    )
    .option(
      '-v, --verbose',
      'Enable verbose progress monitoring',
      false
    )
    .option(
      '--skip-health-check',
      'Skip the initial health check',
      false
    );

  program.parse();

  const options = program.opts();

  const config: ReindexConfig = {
    type: options.type as 'courses' | 'lessons' | 'all',
    batchSize: parseInt(options.batchSize, 10),
    startFromId: options.startFrom,
    dryRun: options.dryRun,
    verbose: options.verbose,
    skipHealthCheck: options.skipHealthCheck,
  };

  try {
    validateConfig(config);
    await performBulkReindex(config);
  } catch (error) {
    logger.error('Script execution failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    promise: String(promise),
  });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Script failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  });
}