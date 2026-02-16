import { createClient } from '@/utils/supabase/server'
import { decrypt } from '@/utils/encryption'
import type { CalendarProvider, CalendarEvent, OAuthTokens, CalendarSource } from '@/types/calendar'

export abstract class BaseCalendarProvider implements CalendarProvider {
  protected abstract source: CalendarSource
  protected tokens: OAuthTokens | null = null

  async authenticate(userId: string): Promise<OAuthTokens> {
    const supabase = await createClient()

    const { data: connection, error } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', this.source)
      .single()

    if (error || !connection) {
      throw new Error(`No ${this.source} calendar connection found. Please connect your calendar first.`)
    }

    const tokens: OAuthTokens = {
      accessToken: decrypt(connection.access_token),
      refreshToken: connection.refresh_token ? decrypt(connection.refresh_token) : undefined,
      expiresAt: connection.token_expires_at ? new Date(connection.token_expires_at) : undefined,
    }

    return this.onTokensLoaded(userId, tokens)
  }

  /**
   * Hook for subclasses to handle post-load token logic (e.g. refresh).
   * Default implementation stores and returns tokens as-is.
   */
  protected async onTokensLoaded(userId: string, tokens: OAuthTokens): Promise<OAuthTokens> {
    this.tokens = tokens
    return tokens
  }

  abstract fetchEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]>

  async revokeAccess(userId: string): Promise<void> {
    const supabase = await createClient()

    const { error } = await supabase
      .from('calendar_connections')
      .delete()
      .eq('user_id', userId)
      .eq('provider', this.source)

    if (error) {
      throw new Error(`Failed to revoke ${this.source} calendar access: ${error.message}`)
    }
  }
}
