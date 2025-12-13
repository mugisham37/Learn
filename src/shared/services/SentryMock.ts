/**
 * Sentry Mock Implementation
 * 
 * Provides mock implementations for Sentry when the actual package is not available
 */

export const mockSentry = {
  init: () => {},
  captureException: () => 'mock-id',
  captureMessage: () => 'mock-id',
  withScope: (callback: (scope: unknown) => unknown) => callback({}),
  setUser: () => {},
  setContext: () => {},
  setTag: () => {},
  addBreadcrumb: () => {},
  startTransaction: () => ({
    setStatus: () => {},
    setTag: () => {},
    finish: () => {},
  }),
  close: () => Promise.resolve(true),
  Integrations: {
    Http: class { constructor() {} },
    OnUncaughtException: class { constructor() {} },
    OnUnhandledRejection: class { constructor() {} },
    LinkedErrors: class { constructor() {} },
  },
};

export const mockProfilingIntegration = class {
  constructor() {}
};