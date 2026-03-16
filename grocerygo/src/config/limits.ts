function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const AI_DAILY_LIMIT = parsePositiveInt(process.env.AI_DAILY_LIMIT, 40)
export const INSTACART_DAILY_LIMIT = parsePositiveInt(process.env.INSTACART_DAILY_LIMIT, 10)

