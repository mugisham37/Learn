/**
 * Formatters Test Suite
 * 
 * Tests for data formatting utilities including dates, currency, duration, and numbers.
 * Includes round-trip testing for validation.
 */

import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatCurrency,
  formatDuration,
  formatNumber,
  formatPercentage,
  formatFileSize,
  parseCurrency,
  parseDuration,
  isToday,
  isYesterday,
} from '../formatters';

describe('Date Formatters', () => {
  it('should format dates with different options', () => {
    const date = new Date('2023-12-25T10:30:00Z');
    
    expect(formatDate(date, { format: 'short' })).toBeTruthy();
    expect(formatDate(date, { format: 'medium' })).toBeTruthy();
    expect(formatDate(date, { format: 'long' })).toBeTruthy();
    expect(formatDate(date, { includeTime: true })).toBeTruthy();
  });

  it('should format relative dates', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    expect(formatDate(oneHourAgo, { relative: true })).toContain('ago');
    expect(formatDate(tomorrow, { relative: true })).toContain('in');
  });

  it('should detect today and yesterday', () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
    
    expect(isToday(today)).toBe(true);
    expect(isToday(yesterday)).toBe(false);
    expect(isYesterday(yesterday)).toBe(true);
    expect(isYesterday(twoDaysAgo)).toBe(false);
  });
});

describe('Currency Formatters', () => {
  it('should format currency with different options', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
    expect(formatCurrency(1234.56, { currency: 'EUR', locale: 'de-DE' })).toBeTruthy();
    expect(formatCurrency(1000000, { notation: 'compact' })).toBeTruthy();
  });

  it('should parse currency strings', () => {
    expect(parseCurrency('$1,234.56')).toBe(1234.56);
    expect(parseCurrency('€1.234,56')).toBeTruthy(); // May vary by locale
  });

  it('should handle currency round-trip', () => {
    const amount = 1234.56;
    const formatted = formatCurrency(amount);
    const parsed = parseCurrency(formatted);
    expect(Math.abs(parsed - amount)).toBeLessThan(0.01);
  });
});

describe('Duration Formatters', () => {
  it('should format durations in different styles', () => {
    const twoHours = 2 * 60 * 60 * 1000;
    
    expect(formatDuration(twoHours, { format: 'short' })).toBe('2h');
    expect(formatDuration(twoHours, { format: 'long' })).toBe('2 hours');
    expect(formatDuration(twoHours, { format: 'compact' })).toBe('2h');
  });

  it('should format complex durations', () => {
    const complexDuration = 2 * 60 * 60 * 1000 + 30 * 60 * 1000; // 2h 30m
    
    expect(formatDuration(complexDuration, { format: 'short' })).toBe('2h 30m');
    expect(formatDuration(complexDuration, { format: 'long' })).toBe('2 hours, 30 minutes');
  });

  it('should parse duration strings', () => {
    expect(parseDuration('2h 30m')).toBe(2.5 * 60 * 60 * 1000);
    expect(parseDuration('1d 2h')).toBe(26 * 60 * 60 * 1000);
  });

  it('should handle duration round-trip', () => {
    const duration = 2 * 60 * 60 * 1000 + 30 * 60 * 1000;
    const formatted = formatDuration(duration, { format: 'short' });
    const parsed = parseDuration(formatted);
    expect(parsed).toBe(duration);
  });
});

describe('Number Formatters', () => {
  it('should format numbers with different options', () => {
    expect(formatNumber(1234.567)).toBe('1,234.567');
    expect(formatNumber(1234.567, { maximumFractionDigits: 2 })).toBe('1,234.57');
    expect(formatNumber(1000000, { notation: 'compact' })).toBeTruthy();
  });

  it('should format percentages', () => {
    expect(formatPercentage(75)).toBe('75%');
    expect(formatPercentage(0.75)).toBe('1%'); // 0.75 / 100 = 0.0075 = 1%
  });

  it('should format file sizes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
  });
});

describe('Error Handling', () => {
  it('should handle invalid inputs gracefully', () => {
    expect(() => formatDate('invalid-date')).toThrow();
    expect(() => formatCurrency(NaN)).toThrow();
    expect(() => formatDuration(-1)).toThrow();
    expect(() => formatNumber(NaN)).toThrow();
  });
});