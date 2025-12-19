/**
 * Data Formatting Utilities
 * 
 * Comprehensive formatting utilities for dates, currency, duration, and numbers
 * with timezone support, localization, and consistent formatting patterns.
 * 
 * Requirements: 9.1, 9.2, 9.3
 */

import { memoize } from './performance';

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface DateFormatOptions {
  timezone?: string;
  locale?: string;
  format?: 'short' | 'medium' | 'long' | 'full' | 'relative' | 'custom';
  customFormat?: Intl.DateTimeFormatOptions;
  includeTime?: boolean;
  relative?: boolean;
}

export interface CurrencyFormatOptions {
  currency?: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  notation?: 'standard' | 'scientific' | 'engineering' | 'compact';
  signDisplay?: 'auto' | 'never' | 'always' | 'exceptZero';
}

export interface DurationFormatOptions {
  format?: 'short' | 'long' | 'compact';
  precision?: 'seconds' | 'minutes' | 'hours' | 'days';
  showZero?: boolean;
  locale?: string;
}

export interface NumberFormatOptions {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  notation?: 'standard' | 'scientific' | 'engineering' | 'compact';
  style?: 'decimal' | 'percent' | 'unit';
  unit?: string;
  unitDisplay?: 'short' | 'long' | 'narrow';
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_LOCALE = 'en-US';
export const DEFAULT_TIMEZONE = 'UTC';
export const DEFAULT_CURRENCY = 'USD';

const DURATION_UNITS = {
  year: 365 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  minute: 60 * 1000,
  second: 1000,
} as const;

// =============================================================================
// Date Formatting
// =============================================================================

/**
 * Formats a date with timezone support and various format options
 */
export const formatDate = memoize((
  date: Date | string | number,
  options: DateFormatOptions = {}
): string => {
  const {
    timezone = DEFAULT_TIMEZONE,
    locale = DEFAULT_LOCALE,
    format = 'medium',
    customFormat,
    includeTime = false,
    relative = false
  } = options;

  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    throw new Error('Invalid date provided to formatDate');
  }

  // Handle relative formatting
  if (relative || format === 'relative') {
    return formatRelativeDate(dateObj, locale);
  }

  // Handle custom format
  if (customFormat) {
    return new Intl.DateTimeFormat(locale, {
      ...customFormat,
      timeZone: timezone,
    }).format(dateObj);
  }

  // Handle predefined formats
  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
  };

  switch (format) {
    case 'short':
      formatOptions.dateStyle = 'short';
      if (includeTime) formatOptions.timeStyle = 'short';
      break;
    case 'medium':
      formatOptions.dateStyle = 'medium';
      if (includeTime) formatOptions.timeStyle = 'short';
      break;
    case 'long':
      formatOptions.dateStyle = 'long';
      if (includeTime) formatOptions.timeStyle = 'medium';
      break;
    case 'full':
      formatOptions.dateStyle = 'full';
      if (includeTime) formatOptions.timeStyle = 'full';
      break;
  }

  return new Intl.DateTimeFormat(locale, formatOptions).format(dateObj);
});

/**
 * Formats a date relative to now (e.g., "2 hours ago", "in 3 days")
 */
export const formatRelativeDate = memoize((
  date: Date | string | number,
  locale: string = DEFAULT_LOCALE
): string => {
  const dateObj = new Date(date);
  const now = new Date();
  const diffMs = dateObj.getTime() - now.getTime();
  
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  
  const absDiff = Math.abs(diffMs);
  
  if (absDiff < DURATION_UNITS.minute) {
    return rtf.format(Math.round(diffMs / DURATION_UNITS.second), 'second');
  } else if (absDiff < DURATION_UNITS.hour) {
    return rtf.format(Math.round(diffMs / DURATION_UNITS.minute), 'minute');
  } else if (absDiff < DURATION_UNITS.day) {
    return rtf.format(Math.round(diffMs / DURATION_UNITS.hour), 'hour');
  } else if (absDiff < DURATION_UNITS.week) {
    return rtf.format(Math.round(diffMs / DURATION_UNITS.day), 'day');
  } else if (absDiff < DURATION_UNITS.month) {
    return rtf.format(Math.round(diffMs / DURATION_UNITS.week), 'week');
  } else if (absDiff < DURATION_UNITS.year) {
    return rtf.format(Math.round(diffMs / DURATION_UNITS.month), 'month');
  } else {
    return rtf.format(Math.round(diffMs / DURATION_UNITS.year), 'year');
  }
});

/**
 * Parses a formatted date string back to a Date object
 * Used for round-trip testing and validation
 */
export const parseFormattedDate = (
  dateString: string,
  timezone: string = DEFAULT_TIMEZONE
): Date => {
  // Try parsing as ISO string first
  const isoDate = new Date(dateString);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // For more complex parsing, we'd need a date parsing library
  // For now, throw an error for unparseable formats
  throw new Error(`Cannot parse date string: ${dateString}`);
};

// =============================================================================
// Currency Formatting
// =============================================================================

/**
 * Formats a number as currency with localization support
 */
export const formatCurrency = memoize((
  amount: number,
  options: CurrencyFormatOptions = {}
): string => {
  const {
    currency = DEFAULT_CURRENCY,
    locale = DEFAULT_LOCALE,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    notation = 'standard',
    signDisplay = 'auto'
  } = options;

  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new Error('Invalid amount provided to formatCurrency');
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
    notation,
    signDisplay,
  }).format(amount);
});

/**
 * Parses a formatted currency string back to a number
 * Used for round-trip testing and validation
 */
export const parseCurrency = (
  currencyString: string,
  locale: string = DEFAULT_LOCALE
): number => {
  // Remove currency symbols and parse
  const cleanString = currencyString.replace(/[^\d.,\-+]/g, '');
  const number = parseFloat(cleanString.replace(',', ''));
  
  if (isNaN(number)) {
    throw new Error(`Cannot parse currency string: ${currencyString}`);
  }
  
  return number;
};

// =============================================================================
// Duration Formatting
// =============================================================================

/**
 * Formats a duration in milliseconds to human-readable format
 */
export const formatDuration = memoize((
  durationMs: number,
  options: DurationFormatOptions = {}
): string => {
  const {
    format = 'short',
    precision = 'minutes',
    showZero = false,
    locale = DEFAULT_LOCALE
  } = options;

  if (typeof durationMs !== 'number' || durationMs < 0) {
    throw new Error('Invalid duration provided to formatDuration');
  }

  if (durationMs === 0 && !showZero) {
    return format === 'long' ? '0 minutes' : '0m';
  }

  const parts: Array<{ value: number; unit: keyof typeof DURATION_UNITS }> = [];
  let remaining = durationMs;

  // Calculate each unit
  for (const [unit, ms] of Object.entries(DURATION_UNITS) as Array<[keyof typeof DURATION_UNITS, number]>) {
    if (remaining >= ms) {
      const value = Math.floor(remaining / ms);
      parts.push({ value, unit });
      remaining -= value * ms;
    }
    
    // Stop at specified precision
    if (unit === precision) break;
  }

  if (parts.length === 0) {
    const smallestUnit = precision === 'seconds' ? 'second' : 'minute';
    return format === 'long' ? `0 ${smallestUnit}s` : '0' + (smallestUnit === 'second' ? 's' : 'm');
  }

  // Format based on style
  switch (format) {
    case 'short':
      return parts.map(({ value, unit }) => {
        const shortUnit = unit === 'year' ? 'y' :
                         unit === 'month' ? 'mo' :
                         unit === 'week' ? 'w' :
                         unit === 'day' ? 'd' :
                         unit === 'hour' ? 'h' :
                         unit === 'minute' ? 'm' :
                         's';
        return `${value}${shortUnit}`;
      }).join(' ');

    case 'long':
      return parts.map(({ value, unit }) => {
        const pluralUnit = value === 1 ? unit : `${unit}s`;
        return `${value} ${pluralUnit}`;
      }).join(', ');

    case 'compact':
      // Show only the two most significant units
      const significantParts = parts.slice(0, 2);
      return significantParts.map(({ value, unit }) => {
        const shortUnit = unit.charAt(0);
        return `${value}${shortUnit}`;
      }).join('');

    default:
      return formatDuration(durationMs, { ...options, format: 'short' });
  }
});

/**
 * Parses a duration string back to milliseconds
 */
export const parseDuration = (durationString: string): number => {
  const regex = /(\d+)\s*([a-zA-Z]+)/g;
  let totalMs = 0;
  let match;

  while ((match = regex.exec(durationString)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    const unitMs = 
      unit.startsWith('y') ? DURATION_UNITS.year :
      unit.startsWith('mo') ? DURATION_UNITS.month :
      unit.startsWith('w') ? DURATION_UNITS.week :
      unit.startsWith('d') ? DURATION_UNITS.day :
      unit.startsWith('h') ? DURATION_UNITS.hour :
      unit.startsWith('m') ? DURATION_UNITS.minute :
      unit.startsWith('s') ? DURATION_UNITS.second :
      0;

    if (unitMs === 0) {
      throw new Error(`Unknown duration unit: ${unit}`);
    }

    totalMs += value * unitMs;
  }

  return totalMs;
};

// =============================================================================
// Number Formatting
// =============================================================================

/**
 * Formats a number with localization support
 */
export const formatNumber = memoize((
  number: number,
  options: NumberFormatOptions = {}
): string => {
  const {
    locale = DEFAULT_LOCALE,
    minimumFractionDigits = 0,
    maximumFractionDigits = 3,
    notation = 'standard',
    style = 'decimal',
    unit,
    unitDisplay = 'short'
  } = options;

  if (typeof number !== 'number' || isNaN(number)) {
    throw new Error('Invalid number provided to formatNumber');
  }

  const formatOptions: Intl.NumberFormatOptions = {
    minimumFractionDigits,
    maximumFractionDigits,
    notation,
    style,
  };

  if (style === 'unit' && unit) {
    formatOptions.unit = unit;
    formatOptions.unitDisplay = unitDisplay;
  }

  return new Intl.NumberFormat(locale, formatOptions).format(number);
});

/**
 * Formats a number as a percentage
 */
export const formatPercentage = memoize((
  value: number,
  options: Omit<NumberFormatOptions, 'style'> = {}
): string => {
  return formatNumber(value / 100, { ...options, style: 'percent' });
});

/**
 * Formats a file size in bytes to human-readable format
 */
export const formatFileSize = memoize((
  bytes: number,
  locale: string = DEFAULT_LOCALE
): string => {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const base = 1024;
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(base));
  const size = bytes / Math.pow(base, unitIndex);

  return `${formatNumber(size, { 
    locale, 
    maximumFractionDigits: unitIndex === 0 ? 0 : 1 
  })} ${units[unitIndex]}`;
});

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Checks if a date is today
 */
export const isToday = (date: Date | string | number): boolean => {
  const dateObj = new Date(date);
  const today = new Date();
  
  return dateObj.toDateString() === today.toDateString();
};

/**
 * Checks if a date is yesterday
 */
export const isYesterday = (date: Date | string | number): boolean => {
  const dateObj = new Date(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  return dateObj.toDateString() === yesterday.toDateString();
};

/**
 * Gets the start of day for a given date
 */
export const startOfDay = (date: Date | string | number): Date => {
  const dateObj = new Date(date);
  dateObj.setHours(0, 0, 0, 0);
  return dateObj;
};

/**
 * Gets the end of day for a given date
 */
export const endOfDay = (date: Date | string | number): Date => {
  const dateObj = new Date(date);
  dateObj.setHours(23, 59, 59, 999);
  return dateObj;
};

// =============================================================================
// Exports
// =============================================================================

export const DateFormatters = {
  formatDate,
  formatRelativeDate,
  parseFormattedDate,
  isToday,
  isYesterday,
  startOfDay,
  endOfDay,
};

export const CurrencyFormatters = {
  formatCurrency,
  parseCurrency,
};

export const DurationFormatters = {
  formatDuration,
  parseDuration,
};

export const NumberFormatters = {
  formatNumber,
  formatPercentage,
  formatFileSize,
};

export const Formatters = {
  ...DateFormatters,
  ...CurrencyFormatters,
  ...DurationFormatters,
  ...NumberFormatters,
};