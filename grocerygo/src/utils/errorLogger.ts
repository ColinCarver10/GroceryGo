/**
 * Centralized error logging utility for server actions
 * Provides structured logging with context-specific information
 */

type ErrorType = 'database' | 'api' | 'validation' | 'parse' | 'auth' | 'unexpected'

interface BaseErrorLog {
  timestamp: string
  action: string
  userId?: string
  errorType: ErrorType
  error: {
    message: string
    code?: string
    [key: string]: unknown
  }
  context?: Record<string, unknown>
  stack?: string
}

interface DatabaseErrorContext {
  table?: string
  operation?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'INSERT/UPDATE'
  queryParams?: Record<string, unknown>
}

interface ApiErrorContext {
  endpoint?: string
  method?: string
  requestBody?: unknown
  statusCode?: number
  responseBody?: unknown
}

interface ValidationErrorContext {
  validationType?: string
  field?: string
  input?: unknown
  reason?: string
}

interface ParseErrorContext {
  dataType?: string
  rawData?: unknown
}

interface AuthErrorContext {
  operation?: string
  authErrorType?: string
}

/**
 * Sanitize sensitive data from objects
 */
function sanitizeData(data: unknown, maxLength: number = 500): unknown {
  if (data === null || data === undefined) {
    return data
  }

  if (typeof data === 'string') {
    // Truncate long strings
    if (data.length > maxLength) {
      return data.substring(0, maxLength) + '... (truncated)'
    }
    return data
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, maxLength))
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {}
    const sensitiveKeys = ['password', 'token', 'apiKey', 'api_key', 'authorization', 'auth', 'secret', 'key']
    
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase()
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '[REDACTED]'
      } else {
        sanitized[key] = sanitizeData(value, maxLength)
      }
    }
    return sanitized
  }

  return String(data).substring(0, maxLength)
}

/**
 * Extract stack trace from error
 */
function getStackTrace(error: unknown): string | undefined {
  if (error instanceof Error && error.stack) {
    return error.stack
  }
  return undefined
}

/**
 * Format error message from various error types
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message)
  }
  return 'Unknown error'
}

/**
 * Extract error code from various error types
 */
function getErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null) {
    if ('code' in error) {
      return String(error.code)
    }
    if ('status' in error && typeof error.status === 'number') {
      return String(error.status)
    }
  }
  return undefined
}

/**
 * Core logging function
 */
function logError(
  action: string,
  errorType: ErrorType,
  error: unknown,
  context?: Record<string, unknown>,
  userId?: string
): void {
  const timestamp = new Date().toISOString()
  const errorMessage = getErrorMessage(error)
  const errorCode = getErrorCode(error)
  const stack = getStackTrace(error)

  // Format for console output
  console.error(`[ERROR] [${timestamp}] [${action}] [${errorType}]`)
  console.error(`  User: ${userId || 'N/A'}`)
  console.error(`  Error: ${errorMessage}`)
  if (errorCode) {
    console.error(`  Code: ${errorCode}`)
  }
  if (context && Object.keys(context).length > 0) {
    console.error(`  Context:`, JSON.stringify(sanitizeData(context), null, 2))
  }
  if (stack) {
    console.error(`  Stack:`, stack)
  }
  console.error('---')
}

/**
 * Log database errors (Supabase)
 */
export function logDatabaseError(
  action: string,
  error: unknown,
  context: DatabaseErrorContext,
  userId?: string
): void {
  const errorContext: Record<string, unknown> = {}
  
  if (context.table) errorContext.table = context.table
  if (context.operation) errorContext.operation = context.operation
  if (context.queryParams) errorContext.queryParams = context.queryParams

  // Extract Supabase-specific error details
  if (typeof error === 'object' && error !== null) {
    const supabaseError = error as { code?: string; message?: string; details?: string; hint?: string }
    if (supabaseError.code) errorContext.supabaseCode = supabaseError.code
    if (supabaseError.details) errorContext.details = supabaseError.details
    if (supabaseError.hint) errorContext.hint = supabaseError.hint
  }

  logError(action, 'database', error, errorContext, userId)
}

/**
 * Log API errors (External APIs like OpenAI, Instacart)
 */
export function logApiError(
  action: string,
  error: unknown,
  context: ApiErrorContext,
  userId?: string
): void {
  const errorContext: Record<string, unknown> = {}
  
  if (context.endpoint) errorContext.endpoint = context.endpoint
  if (context.method) errorContext.method = context.method
  if (context.requestBody) errorContext.requestBody = context.requestBody
  if (context.statusCode) errorContext.statusCode = context.statusCode
  if (context.responseBody) errorContext.responseBody = context.responseBody

  logError(action, 'api', error, errorContext, userId)
}

/**
 * Log internal fetch errors (Internal API calls)
 */
export function logFetchError(
  action: string,
  error: unknown,
  context: {
    url?: string
    method?: string
    requestBody?: unknown
    status?: number
    responseText?: string
  },
  userId?: string
): void {
  const errorContext: Record<string, unknown> = {}
  
  if (context.url) errorContext.url = context.url
  if (context.method) errorContext.method = context.method
  if (context.requestBody) errorContext.requestBody = context.requestBody
  if (context.status) errorContext.status = context.status
  if (context.responseText) errorContext.responseText = context.responseText

  logError(action, 'api', error, errorContext, userId)
}

/**
 * Log validation errors
 */
export function logValidationError(
  action: string,
  error: unknown,
  context: ValidationErrorContext,
  userId?: string
): void {
  const errorContext: Record<string, unknown> = {}
  
  if (context.validationType) errorContext.validationType = context.validationType
  if (context.field) errorContext.field = context.field
  if (context.input) errorContext.input = context.input
  if (context.reason) errorContext.reason = context.reason

  logError(action, 'validation', error, errorContext, userId)
}

/**
 * Log parse errors (JSON, data parsing)
 */
export function logParseError(
  action: string,
  error: unknown,
  context: ParseErrorContext,
  userId?: string
): void {
  const errorContext: Record<string, unknown> = {}
  
  if (context.dataType) errorContext.dataType = context.dataType
  if (context.rawData) errorContext.rawData = context.rawData

  logError(action, 'parse', error, errorContext, userId)
}

/**
 * Log authentication errors
 */
export function logAuthError(
  action: string,
  error: unknown,
  context: AuthErrorContext,
  userId?: string
): void {
  const errorContext: Record<string, unknown> = {}
  
  if (context.operation) errorContext.operation = context.operation
  if (context.authErrorType) errorContext.authErrorType = context.authErrorType

  logError(action, 'auth', error, errorContext, userId)
}

/**
 * Log unexpected errors
 */
export function logUnexpectedError(
  action: string,
  error: unknown,
  context?: Record<string, unknown>,
  userId?: string
): void {
  logError(action, 'unexpected', error, context, userId)
}
