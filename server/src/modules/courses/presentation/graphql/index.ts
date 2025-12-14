/**
 * GraphQL Presentation Layer Index
 *
 * Exports GraphQL schema and resolvers for the courses module.
 *
 * Requirements: 21.1, 21.2, 21.3, 21.5
 */

export { courseTypeDefs } from './schema.js';
export { courseResolvers, type GraphQLContext } from './resolvers.js';
export {
  CourseDataLoaders,
  createCourseDataLoaders,
  type DataLoaderContext,
} from './dataloaders.js';
