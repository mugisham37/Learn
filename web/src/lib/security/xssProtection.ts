/**
 * XSS Prevention Utilities
 *
 * Comprehensive XSS protection utilities for content sanitization and safe rendering.
 * Provides HTML sanitization, content validation, and XSS attack prevention.
 *
 * Requirements: 13.2
 */

import type { XSSProtectionOptions, SanitizationResult, SecurityEvent } from './securityTypes';
import { securityConfig, SECURITY_CONSTANTS, ENVIRONMENT_SECURITY } from './securityConfig';

/**
 * HTML sanitization utility
 */
export class HTMLSanitizer {
  private readonly allowedTags: Set<string>;
  private readonly allowedAttributes: Map<string, Set<string>>;
  private readonly strictMode: boolean;

  constructor(options?: XSSProtectionOptions) {
    const config = securityConfig.xssProtection;

    this.allowedTags = new Set(options?.allowedTags || config.allowedTags);
    this.allowedAttributes = new Map();
    this.strictMode = config.strictMode;

    // Process allowed attributes
    const attributes = options?.allowedAttributes || config.allowedAttributes;
    for (const [tag, attrs] of Object.entries(attributes)) {
      this.allowedAttributes.set(tag, new Set(attrs));
    }
  }

  /**
   * Sanitize HTML content to prevent XSS attacks
   */
  sanitize(html: string): SanitizationResult {
    if (!html || typeof html !== 'string') {
      return {
        sanitized: '',
        removed: [],
        warnings: [],
      };
    }

    // Check content length
    if (html.length > SECURITY_CONSTANTS.MAX_CONTENT_LENGTH) {
      return {
        sanitized: '',
        removed: ['content_too_long'],
        warnings: [
          `Content exceeds maximum length of ${SECURITY_CONSTANTS.MAX_CONTENT_LENGTH} characters`,
        ],
      };
    }

    const removed: string[] = [];
    const warnings: string[] = [];
    let sanitized = html;

    try {
      // Create a temporary DOM element for parsing
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;

      // Process the DOM tree
      const result = this.processNode(tempDiv, removed, warnings);
      sanitized = result.innerHTML;

      // Additional security checks
      sanitized = this.performAdditionalSanitization(sanitized, removed, warnings);

      // Log security events if suspicious content detected
      if (removed.length > 0 || warnings.length > 0) {
        this.logXSSAttempt(html, removed, warnings);
      }

      return {
        sanitized,
        removed,
        warnings,
      };
    } catch (error) {
      console.error('HTML sanitization failed:', error);

      // In case of error, return empty string for security
      return {
        sanitized: '',
        removed: ['sanitization_error'],
        warnings: ['HTML sanitization failed, content removed for security'],
      };
    }
  }

  /**
   * Process DOM node recursively
   */
  private processNode(node: Element, removed: string[], warnings: string[]): Element {
    const nodesToRemove: Node[] = [];

    // Process child nodes
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];

      if (!child) continue;

      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as Element;
        const tagName = element.tagName.toLowerCase();

        if (!this.allowedTags.has(tagName)) {
          // Remove disallowed tags
          nodesToRemove.push(child);
          removed.push(`tag_${tagName}`);

          if (this.strictMode) {
            warnings.push(`Removed disallowed tag: ${tagName}`);
          }
        } else {
          // Process allowed tags
          this.processAttributes(element, removed, warnings);
          this.processNode(element, removed, warnings);
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        // Process text nodes for potential script injection
        const textContent = child.textContent || '';
        if (this.containsSuspiciousContent(textContent)) {
          child.textContent = this.sanitizeTextContent(textContent);
          warnings.push('Sanitized suspicious text content');
        }
      } else if (child.nodeType === Node.COMMENT_NODE) {
        // Remove comments in strict mode
        if (this.strictMode) {
          nodesToRemove.push(child);
          removed.push('comment');
        }
      }
    }

    // Remove flagged nodes
    nodesToRemove.forEach(nodeToRemove => {
      node.removeChild(nodeToRemove);
    });

    return node;
  }

  /**
   * Process element attributes
   */
  private processAttributes(element: Element, removed: string[], warnings: string[]): void {
    const tagName = element.tagName.toLowerCase();
    const allowedAttrs =
      this.allowedAttributes.get(tagName) || this.allowedAttributes.get('*') || new Set();
    const attributesToRemove: string[] = [];

    // Check each attribute
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (!attr) continue;

      const attrName = attr.name.toLowerCase();
      const attrValue = attr.value;

      // Check if attribute is allowed
      if (!allowedAttrs.has(attrName)) {
        attributesToRemove.push(attrName);
        removed.push(`attr_${attrName}`);
        continue;
      }

      // Validate attribute value
      if (this.isUnsafeAttributeValue(attrName, attrValue)) {
        attributesToRemove.push(attrName);
        removed.push(`unsafe_attr_${attrName}`);
        warnings.push(`Removed unsafe attribute value: ${attrName}="${attrValue}"`);
        continue;
      }

      // Sanitize attribute value
      const sanitizedValue = this.sanitizeAttributeValue(attrName, attrValue);
      if (sanitizedValue !== attrValue) {
        element.setAttribute(attrName, sanitizedValue);
        warnings.push(`Sanitized attribute value: ${attrName}`);
      }
    }

    // Remove flagged attributes
    attributesToRemove.forEach(attrName => {
      element.removeAttribute(attrName);
    });
  }

  /**
   * Check if attribute value is unsafe
   */
  private isUnsafeAttributeValue(attrName: string, attrValue: string): boolean {
    const lowerValue = attrValue.toLowerCase().trim();

    // Check for javascript: URLs
    if (attrName === 'href' || attrName === 'src') {
      if (
        lowerValue.startsWith('javascript:') ||
        lowerValue.startsWith('data:text/html') ||
        lowerValue.startsWith('vbscript:')
      ) {
        return true;
      }
    }

    // Check for event handlers
    if (attrName.startsWith('on')) {
      return true;
    }

    // Check for style attribute with suspicious content
    if (attrName === 'style') {
      if (
        lowerValue.includes('expression(') ||
        lowerValue.includes('javascript:') ||
        lowerValue.includes('import') ||
        lowerValue.includes('url(')
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Sanitize attribute value
   */
  private sanitizeAttributeValue(attrName: string, attrValue: string): string {
    let sanitized = attrValue;

    // URL sanitization
    if (attrName === 'href' || attrName === 'src') {
      sanitized = this.sanitizeURL(sanitized);
    }

    // Style sanitization
    if (attrName === 'style') {
      sanitized = this.sanitizeStyle(sanitized);
    }

    // General sanitization
    sanitized = sanitized
      .replace(/[<>'"]/g, '') // Remove potentially dangerous characters
      .trim();

    return sanitized;
  }

  /**
   * Sanitize URL values
   */
  private sanitizeURL(url: string): string {
    const trimmed = url.trim().toLowerCase();

    // Allow only safe protocols
    const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:', 'ftp:'];
    const hasProtocol = safeProtocols.some(protocol => trimmed.startsWith(protocol));

    // If no protocol or relative URL, it's generally safe
    if (
      !trimmed.includes(':') ||
      trimmed.startsWith('/') ||
      trimmed.startsWith('./') ||
      trimmed.startsWith('../')
    ) {
      return url;
    }

    // If has safe protocol, return original
    if (hasProtocol) {
      return url;
    }

    // Otherwise, remove the URL
    return '';
  }

  /**
   * Sanitize CSS style values
   */
  private sanitizeStyle(style: string): string {
    return style
      .replace(/expression\s*\(/gi, '') // Remove CSS expressions
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/import/gi, '') // Remove @import
      .replace(/url\s*\(/gi, '') // Remove url() for safety
      .trim();
  }

  /**
   * Check if text content contains suspicious patterns
   */
  private containsSuspiciousContent(text: string): boolean {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /<link/i,
      /<meta/i,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Sanitize text content
   */
  private sanitizeTextContent(text: string): string {
    return text
      .replace(/<script[\s\S]*?<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Perform additional sanitization checks
   */
  private performAdditionalSanitization(
    html: string,
    removed: string[],
    warnings: string[]
  ): string {
    let sanitized = html;

    // Remove any remaining script tags that might have been missed
    const scriptRegex = /<script[\s\S]*?<\/script>/gi;
    if (scriptRegex.test(sanitized)) {
      sanitized = sanitized.replace(scriptRegex, '');
      removed.push('remaining_scripts');
      warnings.push('Removed remaining script tags');
    }

    // Remove any iframe tags
    const iframeRegex = /<iframe[\s\S]*?<\/iframe>/gi;
    if (iframeRegex.test(sanitized)) {
      sanitized = sanitized.replace(iframeRegex, '');
      removed.push('iframe_tags');
      warnings.push('Removed iframe tags');
    }

    // Remove any object/embed tags
    const objectRegex = /<(object|embed)[\s\S]*?<\/\1>/gi;
    if (objectRegex.test(sanitized)) {
      sanitized = sanitized.replace(objectRegex, '');
      removed.push('object_embed_tags');
      warnings.push('Removed object/embed tags');
    }

    return sanitized;
  }

  /**
   * Log XSS attempt for security monitoring
   */
  private logXSSAttempt(originalContent: string, removed: string[], warnings: string[]): void {
    const event: SecurityEvent = {
      type: 'xss_attempt',
      timestamp: new Date(),
      details: {
        contentLength: originalContent.length,
        removedElements: removed,
        warnings: warnings,
        userAgent: navigator.userAgent,
        url: window.location.href,
      },
      severity: removed.length > 0 ? 'high' : 'medium',
    };

    if (ENVIRONMENT_SECURITY.logSecurityEvents) {
      console.warn('XSS Attempt Detected:', event);
    }

    // In production, this would send to a security monitoring service
    if (ENVIRONMENT_SECURITY.enableSecurityLogging) {
      // TODO: Integrate with security monitoring service
    }
  }
}

/**
 * Content Security Policy utilities
 */
export class CSPManager {
  /**
   * Generate CSP header value from configuration
   */
  static generateCSPHeader(): string {
    const csp = securityConfig.contentSecurityPolicy;
    const directives: string[] = [];

    for (const [directive, values] of Object.entries(csp.directives)) {
      if (values.length > 0) {
        directives.push(`${directive} ${values.join(' ')}`);
      } else {
        directives.push(directive);
      }
    }

    return directives.join('; ');
  }

  /**
   * Validate CSP configuration
   */
  static validateCSP(): string[] {
    const csp = securityConfig.contentSecurityPolicy;
    const errors: string[] = [];

    // Check for required directives
    const requiredDirectives = ['default-src'];
    for (const directive of requiredDirectives) {
      if (!csp.directives[directive]) {
        errors.push(`Missing required CSP directive: ${directive}`);
      }
    }

    // Check for unsafe directives in production
    if (ENVIRONMENT_SECURITY.isProduction) {
      const unsafeValues = ["'unsafe-inline'", "'unsafe-eval'"];
      for (const [directive, values] of Object.entries(csp.directives)) {
        for (const unsafeValue of unsafeValues) {
          if (values.includes(unsafeValue)) {
            errors.push(
              `Unsafe CSP value '${unsafeValue}' in directive '${directive}' for production`
            );
          }
        }
      }
    }

    return errors;
  }
}

/**
 * XSS protection utilities
 */
export class XSSProtector {
  private static sanitizer = new HTMLSanitizer();

  /**
   * Sanitize HTML content for safe display
   */
  static sanitizeHTML(html: string, options?: XSSProtectionOptions): string {
    if (options) {
      const customSanitizer = new HTMLSanitizer(options);
      return customSanitizer.sanitize(html).sanitized;
    }

    return this.sanitizer.sanitize(html).sanitized;
  }

  /**
   * Sanitize text content (escape HTML entities)
   */
  static sanitizeText(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Sanitize URL for safe use in href attributes
   */
  static sanitizeURL(url: string): string {
    if (!url || typeof url !== 'string') {
      return '';
    }

    const trimmed = url.trim().toLowerCase();

    // Block dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:'];
    if (dangerousProtocols.some(protocol => trimmed.startsWith(protocol))) {
      return '';
    }

    // Allow safe protocols and relative URLs
    const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:', 'ftp:'];
    const isRelative =
      trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../');
    const hasSafeProtocol = safeProtocols.some(protocol => trimmed.startsWith(protocol));

    if (isRelative || hasSafeProtocol || !trimmed.includes(':')) {
      return url;
    }

    return '';
  }

  /**
   * Create safe HTML from template and data
   */
  static createSafeHTML(template: string, data: Record<string, unknown>): string {
    let safeHTML = template;

    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      const safeValue = this.sanitizeText(String(value));
      safeHTML = safeHTML.replace(new RegExp(placeholder, 'g'), safeValue);
    }

    return safeHTML;
  }

  /**
   * Validate and sanitize user-generated content
   */
  static validateUserContent(content: string): SanitizationResult {
    return this.sanitizer.sanitize(content);
  }

  /**
   * Check if content is safe (no sanitization needed)
   */
  static isContentSafe(content: string): boolean {
    const result = this.sanitizer.sanitize(content);
    return result.removed.length === 0 && result.warnings.length === 0;
  }
}

// Export singleton instances and utilities
export const htmlSanitizer = new HTMLSanitizer();
export const xssProtector = XSSProtector;
export const cspManager = CSPManager;

// Convenience functions for common use cases
export const sanitizeHTML = XSSProtector.sanitizeHTML;
export const sanitizeText = XSSProtector.sanitizeText;
export const sanitizeURL = XSSProtector.sanitizeURL;
export const createSafeHTML = XSSProtector.createSafeHTML;
export const validateUserContent = XSSProtector.validateUserContent;
export const isContentSafe = XSSProtector.isContentSafe;
