class QuotaError extends Error {
  readonly name = 'QuotaError'
}

function getRpcSingleRow<T>(data: unknown): T | null {
  if (!data) return null
  if (Array.isArray(data)) return (data[0] as T) ?? null
  return data as T
}

export function isQuotaError(error: unknown): error is QuotaError {
  return error instanceof QuotaError
}

export { QuotaError, getRpcSingleRow }

