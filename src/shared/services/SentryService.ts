/**
 * Sentry Error Tracking Service
 * 
 * Integrates Sentry for comprehensive error tracking, performance monitoring,
 * and user context management. Provides error grouping, deduplication,
 * and detailed error reports with context.
 * 
 * Requirements: 17.2
 */

import { FastifyRequest } from 'fastify';
import { config } from '../../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Sentry configuratiointerface
 */
interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  sampleRate: number;
  tracesSampleRate: number;
  profilesSampleRate: number;
  enabled: boolean;
}

/**
 * User context for Sentry
 */
interface SentryUserContext {
  id
 g;

  ip_address?: string;
}

/**
 * Request context for Sentry
 */
interface SentryRequ
  method: string;
  url: string;
  headers: Record<string, 
  query_string?: string;
  data?: unknown;
}

/**
 * Mock Sentry implementation for whelable
 */
interface MockSentry {
  init: (options: unknown) => void;
  captureException: (error: Error) => string;
  captureMessage: (message: string, level?: s
  wi
  d;
 void;
  setTag: (key: string, vad;
  addBreadcrumb: (breadcrud;

  colean>;
  Integrations: {
   
    OnUncaughtException:;
    OnUnhandle
    LinkedErrors: new wn;
  };
}

/**
 * Create mock Sent
 */
ntry = {
  i> {},
  captureException: () => 
  cd',
  withScope: (callback) => ca
  setUser: (){},
  setContext: () 
  setTag: () => {},
  addBreadcrumb: () =>{},
 => ({
,
   },
    finish: () => {},
  }),
  close: () => Promise.resolve(t,
  Integrations: {
    Http: clas) {} },
    OnUncaughtException: class { c) {} },
    OnUnhandledRejection,
    LinkedErrors:
 
};

// Use mock Sentry for now )
cony;

/**
 * Sentry service interface
 */
export interface ISentryService {
  initialize(): void;
  captureException(error: Error, context?: Record<string, unknown>): string;
  captureMessage(message: string, level?: string, cring;
  setUserContext(user: SentryUserContext): void;
  setRequestContext(req;
  addBreadcrumb(message: string, category?: 
 

  in;
  close(timeout?: number): Promian>;
}

/**
 * Sentry service implementation
/
export class Sente {
  private initialized = false;
  pyConfig;

  con) {
    this.config = this.loadConfig();
  }

  /**
   * Load Sentry configuration from environment
   */
  private loadConfig(): SentryConfig {
    return {
      dsn: process.env['SENTRY_DSN'] || '',
      environment: config.nodeEnv,
      release: process.env['SENTRY_RELEASE'] || process.env['npm_package_versi
      ,
   ,

     ,
    };
  }

  /**
   * Initialize Sentry SDK
   */
  initi(): void {
    if (this.
     nabled) {
');
      }
      return;
    }

    try {
      Sentry.init({
        dsn: this.config.dsn,
        environment: thment,
        release: this.config.release,
        sampleRate: this.config.sampleRate,
        tracesSampleRate: this.config.tracesSampleRate,
        integtions: [
          new Sentry.Integrations.Http({ tracing: true }),
          new Sentry.Integrations.OnUncaughtExcepn({
          ed: false,
          }),
          new Sentry.Integrations.OnUnhandledRejection({ mode: 'warn' }),
         

        beforeSend: (event: un(event),
        beforeBreadcrumb: (breadcrumb: unknown) => this.
      });

      this.initialized = true;
      log{
        environment: nt,
        release: this.config.release,
     own',
   
    } catch ({
      });
   }
  }

  /**
   * Capture exception with context
   */
  capturg {
    if (!this.initialized) {
      return '';
    }

    return Sentry.withSco
      const scopeObj = scope as { 
        
        setFingerprint:; 
      };
      
      // Add extra context
      if (
        Object.entries(context).forEach(([key, value]) => {
          scopeObj.setExtra(key, value);
        });
      }

      // Suping
      if (error.name && error.message) {
        scopeObj.setFingerprint([error.name,
      }

      return Sentry.captureException(error);
    });
  }

  /**
   * Captext
   */
  captureMessage(message: string, level: string = 'info', conte
    if (d) {
      return '';
    }

    return Sentry.withScope((scope: unknown) => {
      const scopeObj = scope as { 
        setL> void;
        se
      };
      
      scopeObj.setLevel(level);

      // Add extra context
      if (context) {
        ) => {
          scopeObj.setExtrue);
        });
      }

      return Sentry.captureMess
    });
  }

  /**

   */
  setUserContext(user: SentryUserContext): void {
    if (!this.initialized) {
      return;
    }

    Sentry.setUser(user);
  }

  /**

   */
  setRequestContext(request: Fastif: void {
    i
      return;
    }

    S
;
      
      scopeObj.setCo
        method: request.method,
        url: request.url,
        headers: request.headers,
        quet.query,
      });

      // Set user context if available
      if ('user' in request && request.u
        const user = request.user as { id?: string; email?
       id;

        const role = user.role;

   

     email,
          role,
     
      }
    });
  }

  /**
   * Add breadcrumb
   */
  add

      return;
    }

    Sentry.addBreadcrumb({
      message,
      category,
      level
      d,

  }

  /**
ope
   */
  withScope<T>(callback: (scope: unknown
    i{
      return callback({});
    }

    r
  }

  /**
   * Start performance t
   */
  startTransaction(nam {
    if  {
    return {
 () => {},
     
        finish: () => {},
     };
    }

    return Se, op });
  }

  /**
   * Check if Sentry is enabled
   */
  isEnabled(): boolean {
    return this.initializ
  }

  /**
   * Closction
/
  async close(timeout: number lean> {
    if (!this.initialized) {
      return true;
    }

    return Sentry.close(timeout);
  }

  /**
   * Before send hook for filtering es
   */
  private beforeSend(event{
    const eventObj = event as { 
      excep }> };
      r };
      s
    };

    /ypes
    if (eventObj.exception?.values?.[0]?.type {
     Sentry
    }

    // Add server name
    if (!eventObj.server_name) {
      eventObjknown';
    }

    return event;
  }

  /**
   * Before brrumbs
   */
  private bell {
    const breadcrumbObj = breadcrumb as { 
      category?: string; 
      lg;
   known>;
;

    // Filter out noisy breadcrumbs
    i') {
      return null;
    }

    / data
data) {
      breadcrumbObj.data = Object.from
   
   key,
     
        ])
     
    }

    return breadcrumb;
  }

  /**
   
 */
  priwn> {
    if (!data || typeof data !== 'object') {
     
    }

    {};
)) {
     
        sanitized[key] = `${value.substrin;
     else {
        sanitized[key] = value;
      }
    }


  }
}

/**
 * Global Sentry service instance
 */
export const sentryService = new SentryService();

// Export the class as well for direct instantiation if needed
export { SentryService };