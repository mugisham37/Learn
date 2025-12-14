/**
 * GraphQL Pagination Utilities
 *
 * Implements cursor-based pagination for GraphQL with field selection
 * optimization to reduce payload sizes.
 *
 * Requirements: 15.6
 */

import { GraphQLResolveInfo } from 'graphql';

import { logger } from '../../shared/utils/logger.js';

import { createFieldSelection, filterObjectFields, removeNullValues } from './fieldSelection.js';

/**
 * Pagination input interface
 */
export interface PaginationInput {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

/**
 * Page info interface for cursor-based pagination
 */
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

/**
 * Edge interface for cursor-based pagination
 */
export interface Edge<T> {
  node: T;
  cursor: string;
}

/**
 * Connection interface for cursor-based pagination
 */
export interface Connection<T> {
  edges: Edge<T>[];
  pageInfo: PageInfo;
  totalCount?: number;
}

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  defaultLimit: number;
  maxLimit: number;
  includeTotalCount: boolean;
}

/**
 * Default pagination configuration
 */
const DEFAULT_PAGINATION_CONFIG: PaginationConfig = {
  defaultLimit: 20,
  maxLimit: 100,
  includeTotalCount: true,
};

/**
 * Creates a cursor from a record using a specified field
 */
export function createCursor(record: Record<string, unknown>, cursorField: string = 'id'): string {
  const value = record[cursorField];
  if (value === null || value === undefined) {
    throw new Error(`Cursor field '${cursorField}' is null or undefined`);
  }

  // Handle different data types for cursor values
  let cursorValue: string;
  if (value instanceof Date) {
    cursorValue = value.toISOString();
  } else if (typeof value === 'object') {
    cursorValue = JSON.stringify(value);
  } else {
    cursorValue = String(value);
  }

  return Buffer.from(cursorValue, 'utf8').toString('base64');
}

/**
 * Parses a cursor to extract the original value
 */
export function parseCursor(cursor: string): string {
  try {
    return Buffer.from(cursor, 'base64').toString('utf8');
  } catch (error) {
    throw new Error('Invalid cursor format');
  }
}

/**
 * Validates pagination input
 */
export function validatePaginationInput(input: PaginationInput, config: PaginationConfig): void {
  const { first, last, after, before } = input;

  // Cannot specify both first and last
  if (first !== undefined && last !== undefined) {
    throw new Error('Cannot specify both "first" and "last" arguments');
  }

  // Cannot specify both after and before
  if (after !== undefined && before !== undefined) {
    throw new Error('Cannot specify both "after" and "before" arguments');
  }

  // Validate limits
  if (first !== undefined) {
    if (first < 0) {
      throw new Error('"first" argument must be non-negative');
    }
    if (first > config.maxLimit) {
      throw new Error(`"first" argument cannot exceed ${config.maxLimit}`);
    }
  }

  if (last !== undefined) {
    if (last < 0) {
      throw new Error('"last" argument must be non-negative');
    }
    if (last > config.maxLimit) {
      throw new Error(`"last" argument cannot exceed ${config.maxLimit}`);
    }
  }
}

/**
 * Creates a connection from an array of records
 */
export function createConnection<T>(
  records: T[],
  input: PaginationInput,
  totalCount?: number,
  cursorField: string = 'id',
  config: PaginationConfig = DEFAULT_PAGINATION_CONFIG
): Connection<T> {
  validatePaginationInput(input, config);

  const { first, last } = input;
  const limit = first || last || config.defaultLimit;

  // Create edges with cursors
  const edges: Edge<T>[] = records.map((record) => ({
    node: record,
    cursor: createCursor(record as Record<string, unknown>, cursorField),
  }));

  // Determine pagination info
  const hasNextPage = first !== undefined && records.length === limit;
  const hasPreviousPage = last !== undefined && records.length === limit;

  const pageInfo: PageInfo = {
    hasNextPage,
    hasPreviousPage,
    startCursor: edges.length > 0 ? edges[0]?.cursor : undefined,
    endCursor: edges.length > 0 ? edges[edges.length - 1]?.cursor : undefined,
  };

  const connection: Connection<T> = {
    edges,
    pageInfo,
  };

  // Include total count if configured
  if (config.includeTotalCount && totalCount !== undefined) {
    connection.totalCount = totalCount;
  }

  return connection;
}

/**
 * Creates an optimized connection with field selection
 */
export function createOptimizedConnection<T>(
  records: T[],
  input: PaginationInput,
  info: GraphQLResolveInfo,
  totalCount?: number,
  cursorField: string = 'id',
  config: PaginationConfig = DEFAULT_PAGINATION_CONFIG
): Connection<T> {
  // Create the basic connection
  const connection = createConnection(records, input, totalCount, cursorField, config);

  try {
    // Apply field selection optimization
    const selection = createFieldSelection(info);

    // Check if we need to optimize the nodes
    const nodeSelection = selection.getNestedSelection('edges')?.getNestedSelection('node');

    if (nodeSelection) {
      // Optimize each node in the edges
      connection.edges = connection.edges.map((edge) => ({
        ...edge,
        node: removeNullValues(filterObjectFields(edge.node as Record<string, unknown>, nodeSelection)) as T,
      }));
    } else {
      // Just remove null values if no specific field selection
      connection.edges = connection.edges.map((edge) => ({
        ...edge,
        node: removeNullValues(edge.node),
      }));
    }

    // Log optimization metrics
    if ((process.env as Record<string, string | undefined>)['LOG_PAGINATION_OPTIMIZATION'] === 'true') {
      logger.debug('Pagination response optimized', {
        recordCount: records.length,
        fieldsRequested: nodeSelection?.fields.size || 'all',
        operationName: info.operation.name?.value,
      });
    }
  } catch (error) {
    logger.error('Failed to optimize pagination response', {
      error: error instanceof Error ? error.message : String(error),
      operationName: info.operation.name?.value,
    });
  }

  return connection;
}

/**
 * Offset-based pagination for legacy support
 */
export interface OffsetPaginationInput {
  page?: number;
  limit?: number;
}

/**
 * Offset-based pagination result
 */
export interface OffsetPaginationResult<T> {
  items: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Creates offset-based pagination result
 */
export function createOffsetPagination<T>(
  records: T[],
  input: OffsetPaginationInput,
  totalCount: number,
  config: PaginationConfig = DEFAULT_PAGINATION_CONFIG
): OffsetPaginationResult<T> {
  const page = Math.max(1, input.page || 1);
  const limit = Math.min(input.limit || config.defaultLimit, config.maxLimit);

  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  return {
    items: records,
    totalCount,
    totalPages,
    currentPage: page,
    hasNextPage,
    hasPreviousPage,
  };
}

/**
 * Creates optimized offset-based pagination with field selection
 */
export function createOptimizedOffsetPagination<T>(
  records: T[],
  input: OffsetPaginationInput,
  totalCount: number,
  info: GraphQLResolveInfo,
  config: PaginationConfig = DEFAULT_PAGINATION_CONFIG
): OffsetPaginationResult<T> {
  const result = createOffsetPagination(records, input, totalCount, config);

  try {
    // Apply field selection optimization
    const selection = createFieldSelection(info);
    const itemsSelection = selection.getNestedSelection('items');

    if (itemsSelection) {
      result.items = result.items.map(
        (item) => removeNullValues(filterObjectFields(item as Record<string, unknown>, itemsSelection)) as T
      );
    } else {
      result.items = result.items.map((item) => removeNullValues(item));
    }
  } catch (error) {
    logger.error('Failed to optimize offset pagination response', {
      error: error instanceof Error ? error.message : String(error),
      operationName: info.operation.name?.value,
    });
  }

  return result;
}

/**
 * Utility to extract pagination parameters from GraphQL arguments
 */
export function extractPaginationInput(args: Record<string, unknown>): PaginationInput {
  return {
    first: args['first'] as number | undefined,
    after: args['after'] as string | undefined,
    last: args['last'] as number | undefined,
    before: args['before'] as string | undefined,
  };
}

/**
 * Utility to extract offset pagination parameters from GraphQL arguments
 */
export function extractOffsetPaginationInput(args: Record<string, unknown>): OffsetPaginationInput {
  return {
    page: args['page'] as number | undefined,
    limit: args['limit'] as number | undefined,
  };
}

/**
 * Creates pagination configuration from environment variables
 */
export function createPaginationConfig(): PaginationConfig {
  return {
    defaultLimit: parseInt((process.env as Record<string, string | undefined>)['PAGINATION_DEFAULT_LIMIT'] || '20', 10),
    maxLimit: parseInt((process.env as Record<string, string | undefined>)['PAGINATION_MAX_LIMIT'] || '100', 10),
    includeTotalCount: (process.env as Record<string, string | undefined>)['PAGINATION_INCLUDE_TOTAL_COUNT'] !== 'false',
  };
}
