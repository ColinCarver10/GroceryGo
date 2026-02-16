import { google } from 'googleapis'
import { createClient } from '@/utils/supabase/server'
import { encrypt } from '@/utils/encryption'
import type { CalendarEvent, OAuthTokens, CalendarSource } from '@/types/calendar'
import { BaseCalendarProvider } from './base'

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

export class GoogleCalendarProvider extends BaseCalendarProvider {
  protected source: CalendarSource = 'google'

  protected async onTokensLoaded(userId: string, tokens: OAuthTokens): Promise<OAuthTokens> {
    // Refresh if expired or expiring within 5 minutes
    if (tokens.expiresAt && tokens.expiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
      if (!tokens.refreshToken) {
        throw new Error('Token expired and no refresh token available.')
      }
      const refreshed = await this.refreshTokens(userId, tokens.refreshToken)
      this.tokens = refreshed
      return refreshed
    }

    this.tokens = tokens
    return tokens
  }

  async fetchEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Not authenticated')
    }

    if (!this.tokens) {
      await this.authenticate(user.id)
    }

    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({
      access_token: this.tokens!.accessToken,
      refresh_token: this.tokens!.refreshToken,
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = response.data.items ?? []

    return events.map((event): CalendarEvent => {
      const isAllDay = !event.start?.dateTime
      const startTime = isAllDay
        ? new Date(event.start?.date ?? '')
        : new Date(event.start?.dateTime ?? '')
      const endTime = isAllDay
        ? new Date(event.end?.date ?? '')
        : new Date(event.end?.dateTime ?? '')

      return {
        id: event.id ?? crypto.randomUUID(),
        title: event.summary ?? '(No title)',
        startTime,
        endTime,
        isAllDay,
        source: this.source,
        metadata: {
          location: event.location ?? undefined,
          description: event.description ?? undefined,
          recurrence: event.recurrence?.join(', ') ?? undefined,
        },
      }
    })
  }

  getAuthUrl(state: string): string {
    const oauth2Client = getOAuth2Client()

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state,
      prompt: 'consent',
    })
  }

  private async refreshTokens(userId: string, refreshToken: string): Promise<OAuthTokens> {
    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({ refresh_token: refreshToken })

    const { credentials } = await oauth2Client.refreshAccessToken()

    const tokens: OAuthTokens = {
      accessToken: credentials.access_token ?? '',
      refreshToken: credentials.refresh_token ?? refreshToken,
      expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('calendar_connections')
      .update({
        access_token: encrypt(tokens.accessToken),
        refresh_token: tokens.refreshToken ? encrypt(tokens.refreshToken) : undefined,
        token_expires_at: tokens.expiresAt?.toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', this.source)

    if (error) {
      console.error('Failed to update refreshed tokens:', error.message)
    }

    return tokens
  }
}
