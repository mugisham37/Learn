/**
 * Configuration Module
 * 
 * Central export point for all configuration-related functionality.
 */

// Core configuration
export {
  config,
  authConfig,
  uploadConfig,
  awsConfig,
  cacheConfig,
  realTimeConfig,
  securityConfig,
  errorTrackingConfig,
  apiConfig,
  devToolsConfig,
  validateConfiguration,
  initializeConfiguration,
  env,
} from '../config';

// Configuration monitoring
export {
  checkConfigurationHealth,
  ConfigurationMonitor,
  configurationMonitor,
  initializeConfigurationMonitoring,
  type ConfigurationHealth,
} from './monitoring';

// Error tracking
export {
  initializeErrorTracking,
  reportError,
  reportMessage,
  setUserContext,
  clearUserContext,
  addBreadcrumb,
  startTransaction,
  monitorGraphQLOperation,
  handleErrorBoundary,
  setupGlobalErrorHandlers,
} from './errorTracking';

// Initialization
export {
  initializeAllSystems,
  initializeNextJSConfiguration,
  getInitializationStatus,
  isApplicationReady,
  waitForApplicationReady,
  useInitializationStatus,
} from './initialization';