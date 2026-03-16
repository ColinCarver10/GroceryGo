import type { createClient as createServerClient } from '@/utils/supabase/server'
import { AI_DAILY_LIMIT, INSTACART_DAILY_LIMIT } from '@/config/limits'
import { QuotaError, getRpcSingleRow } from '@/lib/quota'

type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>

export async function assertWithinDailyAIQuota(supabase: SupabaseServerClient, limit: number = AI_DAILY_LIMIT) {
  const { data, error } = await supabase.rpc('increment_ai_usage', { p_daily_limit: limit })
  if (error) throw error

  const row = getRpcSingleRow<{ allowed: boolean }>(data)
  if (!row?.allowed) {
    throw new QuotaError('Daily AI generation limit reached. Please try again tomorrow.')
  }
}

export async function assertWithinInstacartQuota(
  supabase: SupabaseServerClient,
  limit: number = INSTACART_DAILY_LIMIT
) {
  const { data, error } = await supabase.rpc('increment_instacart_usage', { p_daily_limit: limit })
  if (error) throw error

  const row = getRpcSingleRow<{ allowed: boolean }>(data)
  if (!row?.allowed) {
    throw new QuotaError('Daily Instacart link limit reached. Please try again tomorrow.')
  }
}

