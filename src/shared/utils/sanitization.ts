/**
 * HTML Sanitization Utilities
 * 
 * Provides functions to sanitize user-generated HTML content to prevent XSS attacks
 * by removing dangerous tags and attributes while preserving safe formatting.
 * 
 * Requirements:
 * - 13.3: HTML sanitization to prevent XSS attacks
 */

import sanitizeHtml from 'sanitize-html';

/**
 * Default sanitization options for user-generated content
 * Allows basic formatting while removing dangerous elements
 */
const DEFAULT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  // Allow basic formatting tags
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'
  ],
  
  // Allow basic attributes for formatting
  allowedAttributes: {
    '*': ['class'],
    'code': ['class'],
    'pre': ['class']
  },
  
  // Remove all other attributes not explicitly allowed
  allowedClasses: {
    'code': ['language-*', 'hljs-*'],
    'pre': ['language-*', 'hljs-*']
  },
  
  // Disallow all schemes except safe ones
  allowedSchemes: ['http', 'https', 'mailto'],
  
  // Remove empty tags
  exclusiveFilter: (frame) => {
    return frame.tag === 'p' && !frame.text.trim();
  }
};

/**
 * Strict sanitization options for minimal formatting
 * Used for fields where only basic text formatting is needed
 */
const STRICT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i'],
  allowedAttributes: {},
  allowedSchemes: []
};

/**
 * Rich content sanitization options for educational content
 * Allows more formatting options for course content and lessons
 */
const RICH_CONTENT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
    'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
  ],
  
  allowedAttributes: {
    '*': ['class'],
    'a': ['href', 'title', 'rel', 'target'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'code': ['class'],
    'pre': ['class'],
    'table': ['class'],
    'th': ['scope'],
    'td': ['colspan', 'rowspan']
  },
  
  allowedClasses: {
    'code': ['language-*', 'hljs-*'],
    'pre': ['language-*', 'hljs-*'],
    'table': ['table', 'table-*'],
    '*': ['text-*', 'font-*', 'bg-*']
  },
  
  allowedSchemes: ['http', 'https', 'mailto'],
  
  // Transform links to add security attributes
  transformTags: {
    'a': (tagName, attribs) => {
      return {
        tagName: tagName,
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer',
          target: '_blank'
        }
      };
    }
  }
};

/**
 * Sanitizes HTML content using default options
 * Suitable for most user-generated content like messages, posts, comments
 * 
 * @param html - The HTML content to sanitize
 * @returns Sanitized HTML string with dangerous elements removed
 */
export function sanitizeHtmlContent(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  return sanitizeHtml(html.trim(), DEFAULT_SANITIZE_OPTIONS);
}

/**
 * Sanitizes HTML content with strict options
 * Suitable for user profiles, short descriptions, and minimal formatting needs
 * 
 * @param html - The HTML content to sanitize
 * @returns Sanitized HTML string with minimal formatting allowed
 */
export function sanitizeHtmlStrict(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  return sanitizeHtml(html.trim(), STRICT_SANITIZE_OPTIONS);
}

/**
 * Sanitizes HTML content with rich formatting options
 * Suitable for educational content, course descriptions, lesson content
 * 
 * @param html - The HTML content to sanitize
 * @returns Sanitized HTML string with rich formatting preserved
 */
export function sanitizeHtmlRich(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  return sanitizeHtml(html.trim(), RICH_CONTENT_SANITIZE_OPTIONS);
}

/**
 * Sanitizes HTML content with custom options
 * Allows for specific sanitization rules based on context
 * 
 * @param html - The HTML content to sanitize
 * @param options - Custom sanitization options
 * @returns Sanitized HTML string
 */
export function sanitizeHtmlCustom(html: string, options: sanitizeHtml.IOptions): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  return sanitizeHtml(html.trim(), options);
}

/**
 * Strips all HTML tags and returns plain text
 * Useful for search indexing, notifications, and plain text contexts
 * 
 * @param html - The HTML content to convert to plain text
 * @returns Plain text with all HTML tags removed
 */
export function stripHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {}
  });
}

/**
 * Content type mapping for different sanitization levels
 * Maps content types to appropriate sanitization functions
 */
export const CONTENT_SANITIZATION_MAP = {
  // User profiles and basic info
  'user.bio': sanitizeHtmlStrict,
  
  // Course content (rich formatting allowed)
  'course.description': sanitizeHtmlRich,
  'module.description': sanitizeHtmlRich,
  'lesson.contentText': sanitizeHtmlRich,
  
  // Assessment content
  'quiz.description': sanitizeHtmlRich,
  'question.questionText': sanitizeHtmlRich,
  'question.explanation': sanitizeHtmlRich,
  'assignment.description': sanitizeHtmlRich,
  'assignment.instructions': sanitizeHtmlRich,
  'submission.text': sanitizeHtml,
  'feedback': sanitizeHtml,
  
  // Communication content
  'message.content': sanitizeHtml,
  'discussion.content': sanitizeHtml,
  'post.content': sanitizeHtml,
  'announcement.content': sanitizeHtmlRich,
  
  // Default fallback
  'default': sanitizeHtmlContent
} as const;

/**
 * Sanitizes content based on its type
 * Uses predefined sanitization rules for different content types
 * 
 * @param content - The content to sanitize
 * @param contentType - The type of content (determines sanitization level)
 * @returns Sanitized content
 */
export function sanitizeByContentType(
  content: string, 
  contentType: string
): string {
  const sanitizer = CONTENT_SANITIZATION_MAP[contentType as keyof typeof CONTENT_SANITIZATION_MAP] 
    || CONTENT_SANITIZATION_MAP.default;
  
  return sanitizer(content);
}