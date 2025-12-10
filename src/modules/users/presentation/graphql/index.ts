/**
 * GraphQL Presentation Layer Index
 * 
 * Exports GraphQL schema and resolvers for the users module.
 * 
 * Requirements: 21.1, 21.2, 21.3
 */

export { userTypeDefs } from './schema.js';
export { userResolvers, type GraphQLContext } from './resolvers.js';