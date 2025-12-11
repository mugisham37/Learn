/**
 * GraphQL Exports for Enrollments Module
 * 
 * Exports GraphQL schema and resolvers for enrollments functionality.
 * 
 * Requirements: 21.1, 21.2, 21.5
 */

export { enrollmentTypeDefs } from './schema.js';
export { enrollmentResolvers } from './resolvers.js';
export { EnrollmentDataLoaders, createEnrollmentDataLoaders, type EnrollmentDataLoaderContext } from './dataloaders.js';