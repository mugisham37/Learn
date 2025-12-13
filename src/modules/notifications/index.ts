/**
 * Notifications Module
 *
 * Exports all public interfaces and implementations for the notifications module.
 * This module handles multi-channel notification delivery including email, push,
 * and real-time notifications with user preference management.
 *
 * Requirements: 10.1, 10.2, 10.4, 10.5, 10.7
 */

// Domain layer exports
export * from './domain/index.js';

// Application layer exports
export * from './application/index.js';

// Infrastructure layer exports
export * from './infrastructure/index.js';

// Presentation layer exports
export * from './presentation/index.js';
