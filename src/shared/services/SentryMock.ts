/**
 * Sentry Mock Implementation
 *
 * Provides mock implementations for Sentry when the actual package is not available
 */

export const mockSentry = {
  init: (): void => {},
  captureException: (): string => 'mock-id',
  captureMessage: (): string => 'mock-id',
  withScope: (callback: (scope: unknown) => unknown): unknown => callback({}),
  setUser: (): void => {},
  setContext: (): void => {},
  setTag: (): void => {},
  addBreadcrumb: (): void => {},
  startTransaction: (): { setStatus: () => void; setTag: () => void; finish: () => void } => ({
    setStatus: (): void => {},
    setTag: (): void => {},
    finish: (): void => {},
  }),
  close: (): Promise<boolean> => Promise.resolve(true),
  Integrations: {
    Http: class {
      constructor() {}
    },
    OnUncaughtException: class {
      constructor() {}
    },
    OnUnhandledRejection: class {
      constructor() {}
    },
    LinkedErrors: class {
      constructor() {}
    },
  },
};

export const mockProfilingIntegration = class {
  constructor() {}
};
