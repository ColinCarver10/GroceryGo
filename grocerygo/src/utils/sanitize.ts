/**
 * Sanitize user input to remove potentially malicious content
 * Strips HTML, script tags, SQL injection attempts, and code blocks
 */
export function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  let sanitized = input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove script tags and content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove potential SQL injection patterns
    .replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi, '')
    // Remove markdown code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`[^`]*`/g, '')
    // Remove potential XSS attempts
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    // Trim excessive whitespace
    .replace(/\s+/g, ' ')
    .trim()

  // Limit length to prevent abuse
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500)
  }

  return sanitized
}

