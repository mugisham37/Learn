/**
 * User Repository Exports
 *
 * Central export point for user repository interface and implementation
 */

export type { IUserRepository, CreateUserDTO, UpdateUserDTO } from './IUserRepository.js';
export { UserRepository } from './UserRepository.js';
export type {
  IUserProfileRepository,
  CreateUserProfileDTO,
  UpdateUserProfileDTO,
} from './IUserProfileRepository.js';
export { UserProfileRepository } from './UserProfileRepository.js';
