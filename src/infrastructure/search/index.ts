/**
 * Elasticsearch Configuration and Client
 *
 * Manages Elasticsearch connection with retry logic, health checks,
 * index mappings, and aliases for zero-downtime reindexing.
 *
 * Requirements: 8.1
 */

import { Client, ClientOptions } from '@elastic/elasticsearch';
import { config } from '../../config/index.js';
import type { ISearchRepository } from './ISearchRepository.js';

/**
 * Index names for different document types
 */
export const ElasticsearchIndex = {
  COURSES: 'courses',
  LESSONS: 'lessons',
} as const;

/**
 * Index aliases for zero-downtime reindexing
 */
export const ElasticsearchAlias = {
  COURSES: 'courses_active',
  LESSONS: 'lessons_active',
} as const;

/**
 * Retry configuration for Elasticsearch operations
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attempt: number): number {
  const delay = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}

/**
 * Elasticsearch client configuration with retry logic
 */
const clientOptions: ClientOptions = {
  node: config.elasticsearch.node,
  auth: {
    username: config.elasticsearch.username,
    password: config.elasticsearch.password,
  },
  // Connection configuration
  requestTimeout: 30000,
  pingTimeout: 3000,
  // Retry configuration
  maxRetries: RETRY_CONFIG.maxRetries,
  resurrectStrategy: 'ping',
  // Compression
  compression: 'gzip',
  // SSL configuration (for production)
  ssl: {
    rejectUnauthorized: config.nodeEnv === 'production',
  },
};

/**
 * Elasticsearch client instance
 */
export const elasticsearch = new Client(clientOptions);

/**
 * Course index mapping configuration
 * Optimized for full-text search and faceted filtering
 */
export const courseIndexMapping = {
  properties: {
    id: {
      type: 'keyword',
    },
    title: {
      type: 'text',
      analyzer: 'standard',
      fields: {
        keyword: {
          type: 'keyword',
          ignore_above: 256,
        },
        suggest: {
          type: 'completion',
        },
      },
    },
    description: {
      type: 'text',
      analyzer: 'standard',
    },
    slug: {
      type: 'keyword',
    },
    instructorId: {
      type: 'keyword',
    },
    instructorName: {
      type: 'text',
      analyzer: 'standard',
      fields: {
        keyword: {
          type: 'keyword',
          ignore_above: 256,
        },
      },
    },
    category: {
      type: 'keyword',
    },
    difficulty: {
      type: 'keyword',
    },
    price: {
      type: 'float',
    },
    currency: {
      type: 'keyword',
    },
    status: {
      type: 'keyword',
    },
    enrollmentCount: {
      type: 'integer',
    },
    averageRating: {
      type: 'float',
    },
    totalReviews: {
      type: 'integer',
    },
    publishedAt: {
      type: 'date',
    },
    createdAt: {
      type: 'date',
    },
    updatedAt: {
      type: 'date',
    },
    // Nested objects for modules and lessons
    modules: {
      type: 'nested',
      properties: {
        id: { type: 'keyword' },
        title: { type: 'text', analyzer: 'standard' },
        description: { type: 'text', analyzer: 'standard' },
        orderNumber: { type: 'integer' },
        durationMinutes: { type: 'integer' },
      },
    },
    // Aggregated lesson content for search
    lessonContent: {
      type: 'text',
      analyzer: 'standard',
    },
    // Search boost fields
    searchBoost: {
      type: 'float',
    },
    // Popularity metrics for ranking
    popularityScore: {
      type: 'float',
    },
    // Recent enrollment velocity for trending
    recentEnrollmentVelocity: {
      type: 'float',
    },
  },
};

/**
 * Lesson index mapping configuration
 * Optimized for lesson-specific search within courses
 */
export const lessonIndexMapping = {
  properties: {
    id: {
      type: 'keyword',
    },
    moduleId: {
      type: 'keyword',
    },
    courseId: {
      type: 'keyword',
    },
    title: {
      type: 'text',
      analyzer: 'standard',
      fields: {
        keyword: {
          type: 'keyword',
          ignore_above: 256,
        },
      },
    },
    description: {
      type: 'text',
      analyzer: 'standard',
    },
    lessonType: {
      type: 'keyword',
    },
    contentText: {
      type: 'text',
      analyzer: 'standard',
    },
    durationMinutes: {
      type: 'integer',
    },
    orderNumber: {
      type: 'integer',
    },
    isPreview: {
      type: 'boolean',
    },
    createdAt: {
      type: 'date',
    },
    updatedAt: {
      type: 'date',
    },
    // Course information for context
    courseTitle: {
      type: 'text',
      analyzer: 'standard',
    },
    courseCategory: {
      type: 'keyword',
    },
    courseDifficulty: {
      type: 'keyword',
    },
  },
};

/**
 * Index settings for optimal search performance
 */
export const indexSettings = {
  number_of_shards: 1,
  number_of_replicas: config.nodeEnv === 'production' ? 1 : 0,
  analysis: {
    analyzer: {
      course_analyzer: {
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase', 'stop', 'snowball'],
      },
    },
  },
  // Refresh interval for near real-time search
  refresh_interval: '1s',
};

/**
 * Initialize Elasticsearch indices with mappings and aliases
 */
export async function initializeElasticsearchIndices(): Promise<void> {
  console.log('Initializing Elasticsearch indices...');

  try {
    // Create courses index
    await createIndexWithRetry(
      ElasticsearchIndex.COURSES,
      {
        settings: indexSettings,
        mappings: courseIndexMapping,
      },
      ElasticsearchAlias.COURSES
    );

    // Create lessons index
    await createIndexWithRetry(
      ElasticsearchIndex.LESSONS,
      {
        settings: indexSettings,
        mappings: lessonIndexMapping,
      },
      ElasticsearchAlias.LESSONS
    );

    console.log('Elasticsearch indices initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Elasticsearch indices:', error);
    throw error;
  }
}

/**
 * Create an index with retry logic and alias setup
 */
async function createIndexWithRetry(
  indexName: string,
  indexConfig: any,
  aliasName: string
): Promise<void> {
  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      // Check if index already exists
      const indexExists = await elasticsearch.indices.exists({
        index: indexName,
      });

      if (!indexExists) {
        // Create the index
        await elasticsearch.indices.create({
          index: indexName,
          body: indexConfig,
        });

        console.log(`Created Elasticsearch index: ${indexName}`);
      }

      // Check if alias exists
      const aliasExists = await elasticsearch.indices.existsAlias({
        name: aliasName,
      });

      if (!aliasExists) {
        // Create the alias
        await elasticsearch.indices.putAlias({
          index: indexName,
          name: aliasName,
        });

        console.log(`Created Elasticsearch alias: ${aliasName} -> ${indexName}`);
      }

      return;
    } catch (error) {
      const isLastAttempt = attempt === RETRY_CONFIG.maxRetries - 1;

      if (isLastAttempt) {
        console.error(
          `Failed to create index ${indexName} after ${RETRY_CONFIG.maxRetries} attempts:`,
          error
        );
        throw error;
      }

      const delay = calculateBackoffDelay(attempt);
      console.warn(
        `Index creation attempt ${attempt + 1} failed for ${indexName}. Retrying in ${delay}ms...`,
        error instanceof Error ? error.message : error
      );

      await sleep(delay);
    }
  }
}

/**
 * Health check for Elasticsearch connectivity
 * Returns detailed cluster and connection information
 */
export async function checkElasticsearchHealth(): Promise<{
  healthy: boolean;
  cluster?: {
    name: string;
    status: string;
    numberOfNodes: number;
    numberOfDataNodes: number;
  };
  indices?: {
    courses: boolean;
    lessons: boolean;
  };
  latencyMs?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    // Test basic connectivity with cluster health
    const clusterHealth = await elasticsearch.cluster.health();

    // Check if our indices exist
    const [coursesExists, lessonsExists] = await Promise.all([
      elasticsearch.indices.exists({ index: ElasticsearchAlias.COURSES }),
      elasticsearch.indices.exists({ index: ElasticsearchAlias.LESSONS }),
    ]);

    const latencyMs = Date.now() - startTime;

    return {
      healthy: clusterHealth.status !== 'red',
      cluster: {
        name: clusterHealth.cluster_name,
        status: clusterHealth.status,
        numberOfNodes: clusterHealth.number_of_nodes,
        numberOfDataNodes: clusterHealth.number_of_data_nodes,
      },
      indices: {
        courses: coursesExists,
        lessons: lessonsExists,
      },
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    return {
      healthy: false,
      latencyMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Reindex operation for zero-downtime updates
 * Creates a new index, reindexes data, and switches aliases
 */
export async function reindexWithZeroDowntime(
  sourceAlias: string,
  targetIndexName: string,
  indexConfig: any
): Promise<void> {
  console.log(`Starting zero-downtime reindex from ${sourceAlias} to ${targetIndexName}`);

  try {
    // Create new index with timestamp suffix
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newIndexName = `${targetIndexName}_${timestamp}`;

    // Create the new index
    await elasticsearch.indices.create({
      index: newIndexName,
      body: indexConfig,
    });

    console.log(`Created new index: ${newIndexName}`);

    // Reindex data from source to new index
    const reindexResponse = await elasticsearch.reindex({
      body: {
        source: {
          index: sourceAlias,
        },
        dest: {
          index: newIndexName,
        },
      },
      wait_for_completion: true,
      refresh: true,
    });

    console.log(`Reindexed ${reindexResponse.total} documents to ${newIndexName}`);

    // Get current indices behind the alias
    const aliasResponse = await elasticsearch.indices.getAlias({
      name: sourceAlias,
    });

    const oldIndices = Object.keys(aliasResponse);

    // Atomic alias switch
    const actions = [
      // Add new index to alias
      {
        add: {
          index: newIndexName,
          alias: sourceAlias,
        },
      },
      // Remove old indices from alias
      ...oldIndices.map((oldIndex) => ({
        remove: {
          index: oldIndex,
          alias: sourceAlias,
        },
      })),
    ];

    await elasticsearch.indices.updateAliases({
      body: {
        actions,
      },
    });

    console.log(`Switched alias ${sourceAlias} to ${newIndexName}`);

    // Delete old indices after a delay (optional, for safety)
    setTimeout(async () => {
      try {
        for (const oldIndex of oldIndices) {
          await elasticsearch.indices.delete({
            index: oldIndex,
          });
          console.log(`Deleted old index: ${oldIndex}`);
        }
      } catch (error) {
        console.error('Error deleting old indices:', error);
      }
    }, 60000); // 1 minute delay

    console.log('Zero-downtime reindex completed successfully');
  } catch (error) {
    console.error('Zero-downtime reindex failed:', error);
    throw error;
  }
}

/**
 * Bulk index documents with error handling
 */
export async function bulkIndex(
  indexName: string,
  documents: Array<{ id: string; body: any }>
): Promise<{
  success: boolean;
  indexed: number;
  errors: any[];
}> {
  try {
    const body = documents.flatMap((doc) => [
      { index: { _index: indexName, _id: doc.id } },
      doc.body,
    ]);

    const response = await elasticsearch.bulk({
      body,
      refresh: 'wait_for',
    });

    const errors = response.items
      .filter((item: any) => item.index?.error)
      .map((item: any) => item.index.error);

    return {
      success: !response.errors,
      indexed: documents.length - errors.length,
      errors,
    };
  } catch (error) {
    console.error('Bulk index operation failed:', error);
    return {
      success: false,
      indexed: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Delete documents by query
 */
export async function deleteByQuery(
  indexName: string,
  query: any
): Promise<{
  success: boolean;
  deleted: number;
  error?: string;
}> {
  try {
    const response = await elasticsearch.deleteByQuery({
      index: indexName,
      body: {
        query,
      },
      refresh: true,
    });

    return {
      success: true,
      deleted: response.deleted || 0,
    };
  } catch (error) {
    return {
      success: false,
      deleted: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Refresh indices to make recent changes searchable
 */
export async function refreshIndices(indices?: string[]): Promise<void> {
  try {
    await elasticsearch.indices.refresh({
      index: indices?.join(',') || '_all',
    });
  } catch (error) {
    console.error('Failed to refresh indices:', error);
    throw error;
  }
}

/**
 * Get index statistics
 */
export async function getIndexStats(indexName: string): Promise<{
  documentCount: number;
  storeSize: string;
  indexingRate: number;
  searchRate: number;
}> {
  try {
    const stats = await elasticsearch.indices.stats({
      index: indexName,
    });

    const indexStats = stats.indices?.[indexName];
    if (!indexStats) {
      throw new Error(`No stats found for index: ${indexName}`);
    }

    return {
      documentCount: indexStats.total?.docs?.count || 0,
      storeSize: indexStats.total?.store?.size_in_bytes
        ? `${Math.round(indexStats.total.store.size_in_bytes / 1024 / 1024)}MB`
        : '0MB',
      indexingRate: indexStats.total?.indexing?.index_total || 0,
      searchRate: indexStats.total?.search?.query_total || 0,
    };
  } catch (error) {
    console.error(`Failed to get stats for index ${indexName}:`, error);
    return {
      documentCount: 0,
      storeSize: '0MB',
      indexingRate: 0,
      searchRate: 0,
    };
  }
}

/**
 * Close Elasticsearch connection gracefully
 */
export async function closeElasticsearchConnection(): Promise<void> {
  try {
    await elasticsearch.close();
  } catch (error) {
    console.error('Error closing Elasticsearch connection:', error);
  }
}

// Export repository interface and implementation
export type { ISearchRepository } from './ISearchRepository.js';
export { SearchRepository } from './SearchRepository.js';

// Export Elasticsearch client interface and implementation
export type { IElasticsearchClient } from './IElasticsearchClient.js';
export { ElasticsearchClient } from './ElasticsearchClient.js';
import { ElasticsearchClient } from './ElasticsearchClient.js';
import { IElasticsearchClient } from './IElasticsearchClient.js';
import { IElasticsearchClient } from './IElasticsearchClient.js';

/**
 * Create a search repository instance
 * Factory function to create a properly configured search repository
 */
export async function createSearchRepository(): Promise<ISearchRepository> {
  const { SearchRepository } = await import('./SearchRepository.js');
  return new SearchRepository();
}

/**
 * Create an Elasticsearch client instance
 * Factory function to create a properly configured Elasticsearch client wrapper
 */
export function createElasticsearchClient(retryConfig?: {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}): IElasticsearchClient {
  return new ElasticsearchClient(elasticsearch, retryConfig);
}
