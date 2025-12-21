/**
 * Error Message Mapping System
 *
 * Comprehensive error message mapping with localization support,
 * field-specific error extraction, and contextual messaging based
 * on user actions and application state.
 */

import type { ErrorType, ClassifiedError } from './errorTypes';

/**
 * Supported locales for error messages
 */
export type SupportedLocale = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'zh';

/**
 * Error message templates with placeholders
 */
interface ErrorMessageTemplate {
  /** Default message */
  default: string;
  /** Contextual variations */
  contexts?: Record<string, string>;
  /** Field-specific variations */
  fields?: Record<string, string>;
}

/**
 * Localized error messages
 */
const ERROR_MESSAGES: Record<SupportedLocale, Record<ErrorType, ErrorMessageTemplate>> = {
  en: {
    AUTHENTICATION_ERROR: {
      default: 'Please log in to continue.',
      contexts: {
        login: 'Invalid email or password. Please try again.',
        token_expired: 'Your session has expired. Please log in again.',
        token_refresh: 'Unable to refresh your session. Please log in again.',
        registration: 'Registration failed. Please check your information.',
      },
    },
    AUTHORIZATION_ERROR: {
      default: "You don't have permission to perform this action.",
      contexts: {
        course_access: 'You need to enroll in this course to access its content.',
        admin_required: 'This action requires administrator privileges.',
        instructor_required: 'Only course instructors can perform this action.',
        owner_required: 'You can only modify your own content.',
      },
    },
    VALIDATION_ERROR: {
      default: 'Please check your input and try again.',
      fields: {
        email: 'Please enter a valid email address.',
        password: 'Password must be at least 8 characters long.',
        title: 'Course title is required.',
        description: 'Course description is required.',
        price: 'Please enter a valid price.',
        file: 'Please select a valid file.',
      },
      contexts: {
        form_submission: 'Please correct the highlighted fields and try again.',
        file_upload: "The selected file doesn't meet the requirements.",
        course_creation: 'Please complete all required course information.',
      },
    },
    NETWORK_ERROR: {
      default: 'Connection problem. Please check your internet connection.',
      contexts: {
        timeout: 'Request timed out. Please try again.',
        offline: 'You appear to be offline. Please check your connection.',
        rate_limit: 'Too many requests. Please wait a moment and try again.',
        server_error: 'Server is temporarily unavailable. Please try again later.',
      },
    },
    UPLOAD_ERROR: {
      default: 'File upload failed. Please try again.',
      contexts: {
        file_too_large: 'File is too large. Maximum size is {maxSize}.',
        invalid_type: 'File type not supported. Supported types: {supportedTypes}.',
        upload_timeout: 'Upload timed out. Please try again with a smaller file.',
        processing_failed: 'File processing failed. Please try a different file.',
      },
    },
    SUBSCRIPTION_ERROR: {
      default: 'Real-time connection lost. Reconnecting...',
      contexts: {
        connection_failed: 'Unable to establish real-time connection.',
        reconnecting: 'Connection lost. Attempting to reconnect...',
        max_retries: 'Unable to maintain real-time connection. Please refresh the page.',
      },
    },
    CACHE_ERROR: {
      default: 'Data synchronization issue. Please refresh the page.',
      contexts: {
        cache_miss: 'Unable to load cached data. Fetching fresh data...',
        cache_invalid: 'Data may be outdated. Please refresh to see latest changes.',
        cache_full: 'Local storage is full. Please clear some data.',
      },
    },
    UNKNOWN_ERROR: {
      default: 'Something went wrong. Please try again.',
      contexts: {
        unexpected: 'An unexpected error occurred. Our team has been notified.',
        maintenance: 'The system is currently under maintenance. Please try again later.',
        browser_unsupported:
          'Your browser may not be supported. Please try updating or using a different browser.',
      },
    },
  },
  es: {
    AUTHENTICATION_ERROR: {
      default: 'Por favor, inicia sesión para continuar.',
      contexts: {
        login: 'Email o contraseña inválidos. Por favor, inténtalo de nuevo.',
        token_expired: 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.',
        token_refresh: 'No se pudo renovar tu sesión. Por favor, inicia sesión de nuevo.',
        registration: 'El registro falló. Por favor, verifica tu información.',
      },
    },
    AUTHORIZATION_ERROR: {
      default: 'No tienes permisos para realizar esta acción.',
      contexts: {
        course_access: 'Necesitas inscribirte en este curso para acceder a su contenido.',
        admin_required: 'Esta acción requiere privilegios de administrador.',
        instructor_required: 'Solo los instructores del curso pueden realizar esta acción.',
        owner_required: 'Solo puedes modificar tu propio contenido.',
      },
    },
    VALIDATION_ERROR: {
      default: 'Por favor, verifica tu información e inténtalo de nuevo.',
      fields: {
        email: 'Por favor, ingresa una dirección de email válida.',
        password: 'La contraseña debe tener al menos 8 caracteres.',
        title: 'El título del curso es requerido.',
        description: 'La descripción del curso es requerida.',
        price: 'Por favor, ingresa un precio válido.',
        file: 'Por favor, selecciona un archivo válido.',
      },
    },
    NETWORK_ERROR: {
      default: 'Problema de conexión. Por favor, verifica tu conexión a internet.',
      contexts: {
        timeout: 'La solicitud expiró. Por favor, inténtalo de nuevo.',
        offline: 'Parece que estás desconectado. Por favor, verifica tu conexión.',
        rate_limit: 'Demasiadas solicitudes. Por favor, espera un momento e inténtalo de nuevo.',
        server_error:
          'El servidor no está disponible temporalmente. Por favor, inténtalo más tarde.',
      },
    },
    UPLOAD_ERROR: {
      default: 'La subida del archivo falló. Por favor, inténtalo de nuevo.',
      contexts: {
        file_too_large: 'El archivo es demasiado grande. El tamaño máximo es {maxSize}.',
        invalid_type: 'Tipo de archivo no soportado. Tipos soportados: {supportedTypes}.',
        upload_timeout: 'La subida expiró. Por favor, inténtalo con un archivo más pequeño.',
        processing_failed:
          'El procesamiento del archivo falló. Por favor, intenta con un archivo diferente.',
      },
    },
    SUBSCRIPTION_ERROR: {
      default: 'Conexión en tiempo real perdida. Reconectando...',
    },
    CACHE_ERROR: {
      default: 'Problema de sincronización de datos. Por favor, actualiza la página.',
    },
    UNKNOWN_ERROR: {
      default: 'Algo salió mal. Por favor, inténtalo de nuevo.',
    },
  },
  // Additional locales can be added here
  fr: {
    AUTHENTICATION_ERROR: {
      default: 'Veuillez vous connecter pour continuer.',
    },
    AUTHORIZATION_ERROR: {
      default: "Vous n'avez pas la permission d'effectuer cette action.",
    },
    VALIDATION_ERROR: {
      default: 'Veuillez vérifier votre saisie et réessayer.',
    },
    NETWORK_ERROR: {
      default: 'Problème de connexion. Veuillez vérifier votre connexion internet.',
    },
    UPLOAD_ERROR: {
      default: 'Échec du téléchargement du fichier. Veuillez réessayer.',
    },
    SUBSCRIPTION_ERROR: {
      default: 'Connexion temps réel perdue. Reconnexion...',
    },
    CACHE_ERROR: {
      default: 'Problème de synchronisation des données. Veuillez actualiser la page.',
    },
    UNKNOWN_ERROR: {
      default: "Quelque chose s'est mal passé. Veuillez réessayer.",
    },
  },
  de: {
    AUTHENTICATION_ERROR: {
      default: 'Bitte melden Sie sich an, um fortzufahren.',
    },
    AUTHORIZATION_ERROR: {
      default: 'Sie haben keine Berechtigung für diese Aktion.',
    },
    VALIDATION_ERROR: {
      default: 'Bitte überprüfen Sie Ihre Eingabe und versuchen Sie es erneut.',
    },
    NETWORK_ERROR: {
      default: 'Verbindungsproblem. Bitte überprüfen Sie Ihre Internetverbindung.',
    },
    UPLOAD_ERROR: {
      default: 'Datei-Upload fehlgeschlagen. Bitte versuchen Sie es erneut.',
    },
    SUBSCRIPTION_ERROR: {
      default: 'Echtzeit-Verbindung verloren. Verbindung wird wiederhergestellt...',
    },
    CACHE_ERROR: {
      default: 'Datensynchronisationsproblem. Bitte aktualisieren Sie die Seite.',
    },
    UNKNOWN_ERROR: {
      default: 'Etwas ist schief gelaufen. Bitte versuchen Sie es erneut.',
    },
  },
  pt: {
    AUTHENTICATION_ERROR: {
      default: 'Por favor, faça login para continuar.',
    },
    AUTHORIZATION_ERROR: {
      default: 'Você não tem permissão para realizar esta ação.',
    },
    VALIDATION_ERROR: {
      default: 'Por favor, verifique sua entrada e tente novamente.',
    },
    NETWORK_ERROR: {
      default: 'Problema de conexão. Por favor, verifique sua conexão com a internet.',
    },
    UPLOAD_ERROR: {
      default: 'Falha no upload do arquivo. Por favor, tente novamente.',
    },
    SUBSCRIPTION_ERROR: {
      default: 'Conexão em tempo real perdida. Reconectando...',
    },
    CACHE_ERROR: {
      default: 'Problema de sincronização de dados. Por favor, atualize a página.',
    },
    UNKNOWN_ERROR: {
      default: 'Algo deu errado. Por favor, tente novamente.',
    },
  },
  zh: {
    AUTHENTICATION_ERROR: {
      default: '请登录以继续。',
    },
    AUTHORIZATION_ERROR: {
      default: '您没有执行此操作的权限。',
    },
    VALIDATION_ERROR: {
      default: '请检查您的输入并重试。',
    },
    NETWORK_ERROR: {
      default: '连接问题。请检查您的网络连接。',
    },
    UPLOAD_ERROR: {
      default: '文件上传失败。请重试。',
    },
    SUBSCRIPTION_ERROR: {
      default: '实时连接丢失。正在重新连接...',
    },
    CACHE_ERROR: {
      default: '数据同步问题。请刷新页面。',
    },
    UNKNOWN_ERROR: {
      default: '出了点问题。请重试。',
    },
  },
};

/**
 * Error message mapper class
 */
export class ErrorMessageMapper {
  private locale: SupportedLocale = 'en';

  /**
   * Sets the current locale for error messages
   */
  setLocale(locale: SupportedLocale): void {
    this.locale = locale;
  }

  /**
   * Gets the current locale
   */
  getLocale(): SupportedLocale {
    return this.locale;
  }

  /**
   * Gets a localized error message for a classified error
   */
  getMessage(error: ClassifiedError, context?: string): string {
    const messages = ERROR_MESSAGES[this.locale]?.[error.type];

    if (!messages) {
      return this.getFallbackMessage(error);
    }

    // Try to get contextual message first
    if (context && messages.contexts?.[context]) {
      const contextMessage = messages.contexts[context];
      if (contextMessage) {
        return this.interpolateMessage(contextMessage, error);
      }
    }

    // Try to get field-specific message
    if (error.field && messages.fields?.[error.field]) {
      const fieldMessage = messages.fields[error.field];
      if (fieldMessage) {
        return this.interpolateMessage(fieldMessage, error);
      }
    }

    // Fall back to default message
    return this.interpolateMessage(messages.default, error);
  }

  /**
   * Extracts field-specific errors from GraphQL errors
   */
  extractFieldErrors(
    errors: Array<{
      message: string;
      extensions?: {
        code?: string;
        field?: string;
        userMessage?: string;
      };
    }>
  ): Record<string, string> {
    const fieldErrors: Record<string, string> = {};

    errors.forEach(error => {
      if (error.extensions?.field) {
        const field = error.extensions.field;

        // Use custom user message if available
        if (error.extensions.userMessage) {
          fieldErrors[field] = error.extensions.userMessage;
        } else {
          // Get localized field message
          const messages = ERROR_MESSAGES[this.locale]?.VALIDATION_ERROR;
          fieldErrors[field] = messages?.fields?.[field] || error.message;
        }
      }
    });

    return fieldErrors;
  }

  /**
   * Gets contextual error message based on user action
   */
  getContextualMessage(
    error: ClassifiedError,
    userAction?: string,
    additionalContext?: Record<string, unknown>
  ): string {
    // Determine context based on user action
    let context: string | undefined;

    if (userAction) {
      context = this.mapUserActionToContext(error.type, userAction);
    }

    // Use additional context if provided
    if (additionalContext?.context && typeof additionalContext.context === 'string') {
      context = additionalContext.context;
    }

    return this.getMessage(error, context);
  }

  /**
   * Gets all available error messages for a locale
   */
  getAllMessages(locale?: SupportedLocale): Record<ErrorType, ErrorMessageTemplate> {
    const targetLocale = locale || this.locale;
    return ERROR_MESSAGES[targetLocale] || ERROR_MESSAGES.en;
  }

  /**
   * Checks if a locale is supported
   */
  isLocaleSupported(locale: string): locale is SupportedLocale {
    return Object.keys(ERROR_MESSAGES).includes(locale);
  }

  /**
   * Gets available locales
   */
  getAvailableLocales(): SupportedLocale[] {
    return Object.keys(ERROR_MESSAGES) as SupportedLocale[];
  }

  /**
   * Interpolates message with error context data
   */
  private interpolateMessage(message: string, error: ClassifiedError): string {
    let interpolated = message;

    // Replace common placeholders
    if (error.context?.metadata) {
      const metadata = error.context.metadata;

      // Replace {maxSize} placeholder
      if (typeof metadata.maxSize === 'string' || typeof metadata.maxSize === 'number') {
        interpolated = interpolated.replace('{maxSize}', String(metadata.maxSize));
      }

      // Replace {supportedTypes} placeholder
      if (Array.isArray(metadata.supportedTypes)) {
        interpolated = interpolated.replace('{supportedTypes}', metadata.supportedTypes.join(', '));
      }

      // Replace other metadata placeholders
      Object.entries(metadata).forEach(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number') {
          interpolated = interpolated.replace(`{${key}}`, String(value));
        }
      });
    }

    return interpolated;
  }

  /**
   * Maps user action to error context
   */
  private mapUserActionToContext(errorType: ErrorType, userAction: string): string | undefined {
    const actionMappings: Record<ErrorType, Record<string, string>> = {
      AUTHENTICATION_ERROR: {
        login: 'login',
        register: 'registration',
        refresh: 'token_refresh',
      },
      AUTHORIZATION_ERROR: {
        access_course: 'course_access',
        admin_action: 'admin_required',
        instructor_action: 'instructor_required',
        edit_content: 'owner_required',
      },
      VALIDATION_ERROR: {
        submit_form: 'form_submission',
        upload_file: 'file_upload',
        create_course: 'course_creation',
      },
      NETWORK_ERROR: {
        timeout: 'timeout',
        offline: 'offline',
        rate_limit: 'rate_limit',
        server_error: 'server_error',
      },
      UPLOAD_ERROR: {
        file_too_large: 'file_too_large',
        invalid_type: 'invalid_type',
        timeout: 'upload_timeout',
        processing: 'processing_failed',
      },
      SUBSCRIPTION_ERROR: {
        connect: 'connection_failed',
        reconnect: 'reconnecting',
        max_retries: 'max_retries',
      },
      CACHE_ERROR: {
        miss: 'cache_miss',
        invalid: 'cache_invalid',
        full: 'cache_full',
      },
      UNKNOWN_ERROR: {
        unexpected: 'unexpected',
        maintenance: 'maintenance',
        browser: 'browser_unsupported',
      },
    };

    return actionMappings[errorType]?.[userAction];
  }

  /**
   * Gets fallback message when locale is not available
   */
  private getFallbackMessage(error: ClassifiedError): string {
    // Always fall back to English
    const englishMessages = ERROR_MESSAGES.en[error.type];
    return englishMessages?.default || 'An error occurred. Please try again.';
  }
}

// Export singleton instance
export const errorMessageMapper = new ErrorMessageMapper();

// Export utility functions
export const errorMessageUtils = {
  /**
   * Gets a quick error message for display
   */
  getQuickMessage: (error: ClassifiedError, locale?: SupportedLocale): string => {
    if (locale && locale !== errorMessageMapper.getLocale()) {
      const originalLocale = errorMessageMapper.getLocale();
      errorMessageMapper.setLocale(locale);
      const message = errorMessageMapper.getMessage(error);
      errorMessageMapper.setLocale(originalLocale);
      return message;
    }
    return errorMessageMapper.getMessage(error);
  },

  /**
   * Gets field errors in a specific locale
   */
  getFieldErrors: (
    errors: Array<{ message: string; extensions?: { field?: string; userMessage?: string } }>,
    locale?: SupportedLocale
  ): Record<string, string> => {
    if (locale && locale !== errorMessageMapper.getLocale()) {
      const originalLocale = errorMessageMapper.getLocale();
      errorMessageMapper.setLocale(locale);
      const fieldErrors = errorMessageMapper.extractFieldErrors(errors);
      errorMessageMapper.setLocale(originalLocale);
      return fieldErrors;
    }
    return errorMessageMapper.extractFieldErrors(errors);
  },
};
