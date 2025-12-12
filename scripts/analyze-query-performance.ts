#!/usr/bin/env tsx

/**
 * Query Performance Analysis Script
 * 
 * Analyzes database query performance and provides optimization recommendations
 * Requirements: 15.1 - Database query optimization
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../src/config';
import { logger } from '../src/shared/utils/logger';
import { QueryOptimizer } from '../src/shared/utils/queryOptimization';
import { createOptimizationIndexes, analyzeIndexUsage, updateTableStatistics } from '../src/infrastructure/database/optimizations/additionalIndexes';

/**
 * Common queries to analyze
 */
const COMMON_QUERIES = [
  {
    name: 'find_user_by_email',
    query: 'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL',
    params: ['test@example.com'],
  },
  {
    name: 'find_published_courses',
    query: `SELECT * FROM courses WHERE status = 'published' ORDER BY created_at DESC LIMIT 20`,
    params: [],
  },
  {
    name: 'find_user_enrollments',
    query: `
      SELECT e.*, c.title, c.slug 
      FROM enrollments e 
      JOIN courses c ON e.course_id = c.id 
      WHERE e.student_id = $1 AND e.status = 'active'
      ORDER BY e.enrolled_at DESC
    `,
    params: ['550e8400-e29b-41d4-a716-446655440000'],
  },
  {
    name: 'find_course_with_modules',
    query: `
      SELECT c.*, cm.id as module_id, cm.title as module_title, cm.order_number
      FROM courses c
      LEFT JOIN course_modules cm ON c.id = cm.course_id
      WHERE c.id = $1
      ORDER BY cm.order_number
    `,
    params: ['550e8400-e29b-41d4-a716-446655440001'],
  },
  {
    name: 'find_lesson_progress',
    query: `
      SELECT lp.*, l.title, l.lesson_type
      FROM lesson_progress lp
      JOIN lessons l ON lp.lesson_id = l.id
      WHERE lp.enrollment_id = $1
      ORDER BY l.order_number
    `,
    params: ['550e8400-e29b-41d4-a716-446655440002'],
  },
  {
    name: 'course_search_by_category',
    query: `
      SELECT * FROM courses 
      WHERE status = 'published' 
        AND category = $1 
        AND difficulty = $2
      ORDER BY enrollment_count DESC, average_rating DESC
      LIMIT 10
    `,
    params: ['programming', 'beginner'],
  },
  {
    name: 'find_unread_notifications',
    query: `
      SELECT * FROM notifications 
      WHERE recipient_id = $1 AND is_read = false
      ORDER BY created_at DESC
      LIMIT 50
    `,
    params: ['550e8400-e29b-41d4-a716-446655440003'],
  },
  {
    name: 'analytics_events_by_user',
    query: `
      SELECT event_type, COUNT(*) as count
      FROM analytics_events 
      WHERE user_id = $1 
        AND timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY event_type
      ORDER BY count DESC
    `,
    params: ['550e8400-e29b-41d4-a716-446655440004'],
  },
];

/**
 * Configuration
 */
interface AnalysisConfig {
  createIndexes: boolean;
  analyzeQueries: boolean;
  updateStats: boolean;
  generateReport: boolean;
}

/**
 * Main analysis function
 */
async function analyzeQueryPerformance(analysisConfig: AnalysisConfig): Promise<void> {
  logger.info('Starting query performance analysis...');

  // Create database connection
  const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
    max: 5, // Limit connections for analysis
  });

  const db = drizzle(pool);
  const queryOptimizer = new QueryOptimizer(db);

  try {
    // Step 1: Create optimization indexes if requested
    if (analysisConfig.createIndexes) {
      logger.info('Creating optimization indexes...');
      await createOptimizationIndexes(db);
    }

    // Step 2: Update table statistics if requested
    if (analysisConfig.updateStats) {
      logger.info('Updating table statistics...');
      await updateTableStatistics(db);
    }

    // Step 3: Analyze common queries if requested
    if (analysisConfig.analyzeQueries) {
      logger.info('Analyzing common queries...');
      
      const analyses = [];
      for (const queryDef of COMMON_QUERIES) {
        try {
          logger.info(`Analyzing query: ${queryDef.name}`);
          const analysis = await queryOptimizer.analyzeQuery(queryDef.query, queryDef.params);
          analyses.push({ name: queryDef.name, ...analysis });
          
          // Log immediate results for critical queries
          if (analysis.needsOptimization) {
            logger.warn(`Query needs optimization: ${queryDef.name}`, {
              executionTime: analysis.executionTime,
              recommendations: analysis.recommendations,
            });
          }
        } catch (error) {
          logger.error(`Failed to analyze query: ${queryDef.name}`, { error });
        }
      }

      // Generate optimization report
      if (analysisConfig.generateReport && analyses.length > 0) {
        const report = queryOptimizer.generateOptimizationReport(analyses);
        
        logger.info('Query Performance Report', {
          totalQueries: report.totalQueries,
          slowQueries: report.slowQueries,
          averageExecutionTime: `${report.averageExecutionTime.toFixed(2)}ms`,
          topRecommendations: report.topRecommendations,
        });

        // Log critical queries
        if (report.criticalQueries.length > 0) {
          logger.warn('Critical queries requiring immediate attention:', {
            queries: report.criticalQueries.map(q => ({
              name: (q as any).name,
              executionTime: q.executionTime,
              recommendations: q.recommendations.slice(0, 2),
            })),
          });
        }
      }
    }

    // Step 4: Analyze index usage
    logger.info('Analyzing index usage...');
    const indexAnalysis = await analyzeIndexUsage(db);
    
    logger.info('Index Usage Analysis', {
      unusedIndexes: indexAnalysis.unusedIndexes.length,
      heavilyUsedIndexes: indexAnalysis.heavilyUsedIndexes.length,
      largestIndexes: indexAnalysis.indexSizes.slice(0, 5),
    });

    if (indexAnalysis.unusedIndexes.length > 0) {
      logger.warn('Unused indexes detected (consider removing):', {
        indexes: indexAnalysis.unusedIndexes.slice(0, 10),
      });
    }

    logger.info('Query performance analysis completed successfully');

  } catch (error) {
    logger.error('Query performance analysis failed', { error });
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Parse command line arguments
 */
function parseArguments(): AnalysisConfig {
  const args = process.argv.slice(2);
  
  return {
    createIndexes: args.includes('--create-indexes'),
    analyzeQueries: args.includes('--analyze-queries') || args.length === 0, // Default to true
    updateStats: args.includes('--update-stats'),
    generateReport: args.includes('--generate-report') || args.length === 0, // Default to true
  };
}

/**
 * Display usage information
 */
function displayUsage(): void {
  console.log(`
Query Performance Analysis Script

Usage: npm run analyze-queries [options]

Options:
  --create-indexes    Create optimization indexes
  --analyze-queries   Analyze common queries (default)
  --update-stats      Update table statistics
  --generate-report   Generate performance report (default)
  --help             Show this help message

Examples:
  npm run analyze-queries                           # Analyze queries and generate report
  npm run analyze-queries --create-indexes          # Create indexes only
  npm run analyze-queries --update-stats            # Update statistics only
  npm run analyze-queries --create-indexes --analyze-queries --update-stats --generate-report  # Full analysis

Environment Variables:
  DATABASE_URL       Database connection string
  LOG_LEVEL         Logging level (debug, info, warn, error)
`);
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    displayUsage();
    return;
  }

  const analysisConfig = parseArguments();
  
  logger.info('Query Performance Analysis Configuration', analysisConfig);
  
  try {
    await analyzeQueryPerformance(analysisConfig);
    process.exit(0);
  } catch (error) {
    logger.error('Analysis failed', { error });
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { analyzeQueryPerformance, parseArguments };