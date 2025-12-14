/**
 * Log Pruning Service
 *
 * Handles cleanup of old log files and log entries to manage disk space
 * and maintain system performance. Runs daily to prune logs older than
 * the configured retention period.
 *
 * Requirements: 14.7 - Daily log pruning
 */

import { promises as fs } from 'fs';
import { join } from 'path';

import { logger } from '../utils/logger.js';

/**
 * Log pruning configuration
 */
export interface LogPruningConfig {
  /** Log retention period in days */
  retentionDays: number;
  /** Log directory path */
  logDirectory: string;
  /** Maximum log file size in MB before rotation */
  maxFileSizeMB: number;
  /** Maximum number of log files to keep */
  maxFiles: number;
  /** Batch size for processing log entries */
  batchSize: number;
  /** Whether to compress old log files */
  compressOldLogs: boolean;
}

/**
 * Default log pruning configuration
 */
const DEFAULT_CONFIG: LogPruningConfig = {
  retentionDays: 30,
  logDirectory: './logs',
  maxFileSizeMB: 100,
  maxFiles: 10,
  batchSize: 1000,
  compressOldLogs: true,
};

/**
 * Log file information
 */
interface LogFileInfo {
  path: string;
  name: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  isCompressed: boolean;
}

/**
 * Log Pruning Service Implementation
 */
export class LogPruningService {
  private config: LogPruningConfig;

  constructor(config: Partial<LogPruningConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute complete log pruning
   */
  async executePruning(): Promise<{
    filesRemoved: number;
    filesCompressed: number;
    spaceSavedMB: number;
    oldestLogDate: Date | null;
  }> {
    const startTime = Date.now();
    logger.info('Starting log pruning process', {
      config: this.config,
    });

    try {
      const results = {
        filesRemoved: 0,
        filesCompressed: 0,
        spaceSavedMB: 0,
        oldestLogDate: null as Date | null,
      };

      // Ensure log directory exists
      await this.ensureLogDirectory();

      // Get all log files
      const logFiles = await this.getLogFiles();

      if (logFiles.length === 0) {
        logger.info('No log files found for pruning');
        return results;
      }

      // Calculate cutoff date for retention
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      // Find oldest log date
      results.oldestLogDate = logFiles.reduce(
        (oldest, file) => {
          return !oldest || file.createdAt < oldest ? file.createdAt : oldest;
        },
        null as Date | null
      );

      // Separate files into categories
      const filesToRemove = logFiles.filter((file) => file.createdAt < cutoffDate);
      const filesToCompress = logFiles.filter(
        (file) =>
          file.createdAt >= cutoffDate &&
          !file.isCompressed &&
          file.size > this.config.maxFileSizeMB * 1024 * 1024
      );

      // Remove old files
      for (const file of filesToRemove) {
        try {
          await fs.unlink(file.path);
          results.filesRemoved++;
          results.spaceSavedMB += file.size / (1024 * 1024);

          logger.debug('Removed old log file', {
            file: file.name,
            size: file.size,
            createdAt: file.createdAt,
          });
        } catch (error) {
          logger.error('Failed to remove log file', {
            file: file.path,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Compress large files if enabled
      if (this.config.compressOldLogs) {
        for (const file of filesToCompress) {
          try {
            const compressedSize = await this.compressLogFile(file);
            results.filesCompressed++;
            results.spaceSavedMB += (file.size - compressedSize) / (1024 * 1024);

            logger.debug('Compressed log file', {
              file: file.name,
              originalSize: file.size,
              compressedSize,
              compressionRatio: (((file.size - compressedSize) / file.size) * 100).toFixed(2) + '%',
            });
          } catch (error) {
            logger.error('Failed to compress log file', {
              file: file.path,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      // Enforce maximum file count
      const remainingFiles = await this.getLogFiles();
      if (remainingFiles.length > this.config.maxFiles) {
        const filesToRemoveByCount = remainingFiles
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .slice(0, remainingFiles.length - this.config.maxFiles);

        for (const file of filesToRemoveByCount) {
          try {
            await fs.unlink(file.path);
            results.filesRemoved++;
            results.spaceSavedMB += file.size / (1024 * 1024);

            logger.debug('Removed log file due to count limit', {
              file: file.name,
              size: file.size,
            });
          } catch (error) {
            logger.error('Failed to remove log file by count', {
              file: file.path,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Log pruning completed successfully', {
        results: {
          ...results,
          spaceSavedMB: Math.round(results.spaceSavedMB * 100) / 100,
        },
        durationMs: duration,
      });

      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Log pruning failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: duration,
      });
      throw error;
    }
  }

  /**
   * Ensure log directory exists
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.access(this.config.logDirectory);
    } catch {
      await fs.mkdir(this.config.logDirectory, { recursive: true });
      logger.info('Created log directory', {
        directory: this.config.logDirectory,
      });
    }
  }

  /**
   * Get all log files in the log directory
   */
  private async getLogFiles(): Promise<LogFileInfo[]> {
    try {
      const files = await fs.readdir(this.config.logDirectory);
      const logFiles: LogFileInfo[] = [];

      for (const file of files) {
        // Only process .log files and compressed .log.gz files
        if (!file.endsWith('.log') && !file.endsWith('.log.gz')) {
          continue;
        }

        const filePath = join(this.config.logDirectory, file);

        try {
          const stats = await fs.stat(filePath);

          logFiles.push({
            path: filePath,
            name: file,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            isCompressed: file.endsWith('.gz'),
          });
        } catch (error) {
          logger.warn('Failed to get stats for log file', {
            file: filePath,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return logFiles.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    } catch (error) {
      logger.error('Failed to read log directory', {
        directory: this.config.logDirectory,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Compress a log file using gzip
   */
  private async compressLogFile(file: LogFileInfo): Promise<number> {
    const { createReadStream, createWriteStream } = await import('fs');
    const { createGzip } = await import('zlib');
    const { pipeline } = await import('stream/promises');

    const compressedPath = file.path + '.gz';

    // Create compression pipeline
    const readStream = createReadStream(file.path);
    const gzipStream = createGzip({ level: 9 });
    const writeStream = createWriteStream(compressedPath);

    // Compress the file
    await pipeline(readStream, gzipStream, writeStream);

    // Get compressed file size
    const compressedStats = await fs.stat(compressedPath);

    // Remove original file
    await fs.unlink(file.path);

    return compressedStats.size;
  }

  /**
   * Get log pruning statistics
   */
  async getPruningStats(): Promise<{
    totalLogFiles: number;
    totalLogSizeMB: number;
    oldestLogDate: Date | null;
    newestLogDate: Date | null;
    compressedFiles: number;
    uncompressedFiles: number;
  }> {
    try {
      const logFiles = await this.getLogFiles();

      const stats = {
        totalLogFiles: logFiles.length,
        totalLogSizeMB: 0,
        oldestLogDate: null as Date | null,
        newestLogDate: null as Date | null,
        compressedFiles: 0,
        uncompressedFiles: 0,
      };

      if (logFiles.length === 0) {
        return stats;
      }

      // Calculate statistics
      stats.totalLogSizeMB = logFiles.reduce((total, file) => total + file.size, 0) / (1024 * 1024);
      stats.oldestLogDate = logFiles[0]?.createdAt ?? null;
      stats.newestLogDate = logFiles[logFiles.length - 1]?.createdAt ?? null;
      stats.compressedFiles = logFiles.filter((file) => file.isCompressed).length;
      stats.uncompressedFiles = logFiles.filter((file) => !file.isCompressed).length;

      // Round to 2 decimal places
      stats.totalLogSizeMB = Math.round(stats.totalLogSizeMB * 100) / 100;

      return stats;
    } catch (error) {
      logger.error('Failed to get pruning stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Manually prune logs older than specified days
   */
  async pruneLogsOlderThan(days: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const logFiles = await this.getLogFiles();
      const filesToRemove = logFiles.filter((file) => file.createdAt < cutoffDate);

      let removedCount = 0;
      for (const file of filesToRemove) {
        try {
          await fs.unlink(file.path);
          removedCount++;

          logger.debug('Manually removed old log file', {
            file: file.name,
            age: Math.floor((Date.now() - file.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
          });
        } catch (error) {
          logger.error('Failed to manually remove log file', {
            file: file.path,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      logger.info('Manual log pruning completed', {
        removedCount,
        cutoffDays: days,
      });

      return removedCount;
    } catch (error) {
      logger.error('Manual log pruning failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Health check for log pruning service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if log directory is accessible
      await fs.access(this.config.logDirectory);

      // Check if we can read the directory
      await fs.readdir(this.config.logDirectory);

      return true;
    } catch (error) {
      logger.error('Log pruning service health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

/**
 * Singleton instance of LogPruningService
 */
let logPruningServiceInstance: LogPruningService | null = null;

/**
 * Get the singleton LogPruningService instance
 */
export function getLogPruningService(): LogPruningService {
  if (!logPruningServiceInstance) {
    logPruningServiceInstance = new LogPruningService();
  }
  return logPruningServiceInstance;
}

/**
 * Initialize log pruning service with custom config
 */
export function initializeLogPruningService(config?: Partial<LogPruningConfig>): LogPruningService {
  logPruningServiceInstance = new LogPruningService(config);
  return logPruningServiceInstance;
}
