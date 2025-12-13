/**
 * GraphQL Field Selection Utilities
 *
 * Implements field selection optimization to reduce payload sizes by
 * returning only the fields requested in GraphQL queries.
 *
 * Requirements: 15.6
 */

import { GraphQLResolveInfo, FieldNode, SelectionNode } from 'graphql';
import { logger } from '../../shared/utils/logger.js';

/**
 * Interface for field selection result
 */
export interface FieldSelection {
  fields: Set<string>;
  nestedFields: Map<string, FieldSelection>;
  hasField: (fieldName: string) => boolean;
  getNestedSelection: (fieldName: string) => FieldSelection | undefined;
}

/**
 * Creates a field selection object from GraphQL resolve info
 */
export function createFieldSelection(info: GraphQLResolveInfo): FieldSelection {
  const fields = new Set<string>();
  const nestedFields = new Map<string, FieldSelection>();

  // Parse the selection set from the GraphQL query
  if (info.fieldNodes && info.fieldNodes.length > 0) {
    for (const fieldNode of info.fieldNodes) {
      if (fieldNode.selectionSet) {
        parseSelectionSet(fieldNode.selectionSet.selections, fields, nestedFields, info);
      }
    }
  }

  return {
    fields,
    nestedFields,
    hasField: (fieldName: string) => fields.has(fieldName),
    getNestedSelection: (fieldName: string) => nestedFields.get(fieldName),
  };
}

/**
 * Recursively parses GraphQL selection sets
 */
function parseSelectionSet(
  selections: readonly SelectionNode[],
  fields: Set<string>,
  nestedFields: Map<string, FieldSelection>,
  info: GraphQLResolveInfo,
  fragmentMap?: Map<string, FieldNode>
): void {
  for (const selection of selections) {
    switch (selection.kind) {
      case 'Field':
        const fieldName = selection.name.value;
        fields.add(fieldName);

        // Handle nested selections
        if (selection.selectionSet) {
          const nestedFieldSet = new Set<string>();
          const nestedNestedFields = new Map<string, FieldSelection>();

          parseSelectionSet(
            selection.selectionSet.selections,
            nestedFieldSet,
            nestedNestedFields,
            info,
            fragmentMap
          );

          nestedFields.set(fieldName, {
            fields: nestedFieldSet,
            nestedFields: nestedNestedFields,
            hasField: (name: string) => nestedFieldSet.has(name),
            getNestedSelection: (name: string) => nestedNestedFields.get(name),
          });
        }
        break;

      case 'InlineFragment':
        // Handle inline fragments
        if (selection.selectionSet) {
          parseSelectionSet(
            selection.selectionSet.selections,
            fields,
            nestedFields,
            info,
            fragmentMap
          );
        }
        break;

      case 'FragmentSpread':
        // Handle fragment spreads
        const fragmentName = selection.name.value;
        const fragment = info.fragments[fragmentName];
        if (fragment && fragment.selectionSet) {
          parseSelectionSet(
            fragment.selectionSet.selections,
            fields,
            nestedFields,
            info,
            fragmentMap
          );
        }
        break;
    }
  }
}

/**
 * Filters an object to include only selected fields
 */
export function filterObjectFields<T extends Record<string, any>>(
  obj: T,
  selection: FieldSelection
): Partial<T> {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const filtered: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (selection.hasField(key)) {
      const nestedSelection = selection.getNestedSelection(key);

      if (nestedSelection && value && typeof value === 'object') {
        if (Array.isArray(value)) {
          // Handle arrays of objects
          filtered[key as keyof T] = value.map((item) =>
            typeof item === 'object' ? filterObjectFields(item, nestedSelection) : item
          ) as T[keyof T];
        } else {
          // Handle nested objects
          filtered[key as keyof T] = filterObjectFields(value, nestedSelection) as T[keyof T];
        }
      } else {
        filtered[key as keyof T] = value;
      }
    }
  }

  return filtered;
}

/**
 * Removes null and undefined values from an object
 */
export function removeNullValues<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== null && item !== undefined)
      .map((item) => removeNullValues(item)) as T;
  }

  if (typeof obj === 'object') {
    const cleaned: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        cleaned[key] = removeNullValues(value);
      }
    }

    return cleaned;
  }

  return obj;
}

/**
 * Optimizes GraphQL response by applying field selection and removing null values
 */
export function optimizeGraphQLResponse<T>(
  data: T,
  info: GraphQLResolveInfo,
  options: {
    removeNulls?: boolean;
    logOptimization?: boolean;
  } = {}
): T {
  const { removeNulls = true, logOptimization = false } = options;

  try {
    // Create field selection from GraphQL info
    const selection = createFieldSelection(info);

    // Apply field filtering
    let optimized = filterObjectFields(data as any, selection) as T;

    // Remove null values if requested
    if (removeNulls) {
      optimized = removeNullValues(optimized);
    }

    // Log optimization metrics if requested
    if (logOptimization) {
      const originalSize = JSON.stringify(data).length;
      const optimizedSize = JSON.stringify(optimized).length;
      const reduction = Math.round(((originalSize - optimizedSize) / originalSize) * 100);

      logger.debug('GraphQL response optimized', {
        originalSize,
        optimizedSize,
        reductionPercentage: reduction,
        fieldsRequested: selection.fields.size,
        operationName: info.operation.name?.value,
      });
    }

    return optimized;
  } catch (error) {
    logger.error('Failed to optimize GraphQL response', {
      error: error instanceof Error ? error.message : String(error),
      operationName: info.operation.name?.value,
    });

    // Return original data if optimization fails
    return removeNulls ? removeNullValues(data) : data;
  }
}

/**
 * Middleware to automatically optimize GraphQL responses
 */
export function createResponseOptimizationPlugin() {
  return {
    requestDidStart() {
      return {
        willSendResponse({ response, request }: any) {
          try {
            // Only optimize successful responses with data
            if (response.body.kind === 'single' && response.body.singleResult.data) {
              const originalData = response.body.singleResult.data;

              // Apply null value removal (field selection is handled at resolver level)
              const optimizedData = removeNullValues(originalData);

              // Update response with optimized data
              response.body.singleResult.data = optimizedData;

              // Log optimization if enabled
              if (process.env.LOG_RESPONSE_OPTIMIZATION === 'true') {
                const originalSize = JSON.stringify(originalData).length;
                const optimizedSize = JSON.stringify(optimizedData).length;
                const reduction = Math.round(((originalSize - optimizedSize) / originalSize) * 100);

                logger.debug('Response optimized', {
                  operationName: request.operationName,
                  originalSize,
                  optimizedSize,
                  reductionPercentage: reduction,
                });
              }
            }
          } catch (error) {
            logger.error('Failed to optimize response in plugin', {
              error: error instanceof Error ? error.message : String(error),
              operationName: request.operationName,
            });
          }
        },
      };
    },
  };
}

/**
 * Helper function to check if a field is requested in the GraphQL query
 */
export function isFieldRequested(info: GraphQLResolveInfo, fieldName: string): boolean {
  const selection = createFieldSelection(info);
  return selection.hasField(fieldName);
}

/**
 * Helper function to get nested field selection for a specific field
 */
export function getNestedFieldSelection(
  info: GraphQLResolveInfo,
  fieldName: string
): FieldSelection | undefined {
  const selection = createFieldSelection(info);
  return selection.getNestedSelection(fieldName);
}

/**
 * Utility to create a minimal object with only requested fields
 */
export function createMinimalResponse<T extends Record<string, any>>(
  data: T,
  info: GraphQLResolveInfo
): Partial<T> {
  const selection = createFieldSelection(info);
  return filterObjectFields(data, selection);
}
