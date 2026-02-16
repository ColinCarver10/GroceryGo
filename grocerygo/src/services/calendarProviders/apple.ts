import { createDAVClient, DAVCalendar } from 'tsdav'
import { createClient } from '@/utils/supabase/server'
import type { CalendarEvent, CalendarSource } from '@/types/calendar'
import { BaseCalendarProvider } from './base'

const CALDAV_URL = 'https://caldav.icloud.com'

export class AppleCalendarProvider extends BaseCalendarProvider {
  protected source: CalendarSource = 'apple'

  async fetchEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Not authenticated')
    }

    if (!this.tokens) {
      await this.authenticate(user.id)
    }

    // For Apple CalDAV: accessToken = app-specific password, refreshToken = Apple ID email
    const appleIdEmail = this.tokens!.refreshToken
    const appSpecificPassword = this.tokens!.accessToken

    if (!appleIdEmail || !appSpecificPassword) {
      throw new Error('Apple Calendar credentials are incomplete.')
    }

    const client = await createDAVClient({
      serverUrl: CALDAV_URL,
      credentials: {
        username: appleIdEmail,
        password: appSpecificPassword,
      },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    })

    const calendars: DAVCalendar[] = await client.fetchCalendars()

    const allEvents: CalendarEvent[] = []

    for (const calendar of calendars) {
      const calendarObjects = await client.fetchCalendarObjects({
        calendar,
        timeRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      })

      for (const obj of calendarObjects) {
        if (obj.data) {
          const event = parseICSEvent(obj.data, obj.url)
          if (event) {
            allEvents.push(event)
          }
        }
      }
    }

    return allEvents
  }
}

function parseICSEvent(icsData: string, url: string): CalendarEvent | null {
  const lines = icsData.split(/\r?\n/)

  let summary = '(No title)'
  let dtstart = ''
  let dtend = ''
  let location: string | undefined
  let description: string | undefined
  let uid = url
  let found = 0

  for (const line of lines) {
    if (line.startsWith('SUMMARY:')) {
      summary = line.substring('SUMMARY:'.length).trim()
      found++
    } else if (line.startsWith('DTSTART')) {
      const colonIdx = line.indexOf(':')
      if (colonIdx !== -1) {
        dtstart = line.substring(colonIdx + 1).trim()
        found++
      }
    } else if (line.startsWith('DTEND')) {
      const colonIdx = line.indexOf(':')
      if (colonIdx !== -1) {
        dtend = line.substring(colonIdx + 1).trim()
        found++
      }
    } else if (line.startsWith('LOCATION:')) {
      location = line.substring('LOCATION:'.length).trim()
      found++
    } else if (line.startsWith('DESCRIPTION:')) {
      description = line.substring('DESCRIPTION:'.length).trim()
      found++
    } else if (line.startsWith('UID:')) {
      uid = line.substring('UID:'.length).trim()
      found++
    }
    if (found === 6) break
  }

  if (!dtstart) {
    return null
  }

  const startTime = parseICSDate(dtstart)
  const endTime = dtend ? parseICSDate(dtend) : startTime
  const isAllDay = dtstart.length === 8 // YYYYMMDD format

  return {
    id: uid,
    title: summary,
    startTime,
    endTime,
    isAllDay,
    source: 'apple',
    metadata: {
      location,
      description,
    },
  }
}

function parseICSDate(dateStr: string): Date {
  // All-day format: YYYYMMDD
  if (dateStr.length === 8) {
    const year = parseInt(dateStr.substring(0, 4), 10)
    const month = parseInt(dateStr.substring(4, 6), 10) - 1
    const day = parseInt(dateStr.substring(6, 8), 10)
    return new Date(year, month, day)
  }

  // DateTime format: YYYYMMDDTHHmmssZ or YYYYMMDDTHHmmss
  const year = parseInt(dateStr.substring(0, 4), 10)
  const month = parseInt(dateStr.substring(4, 6), 10) - 1
  const day = parseInt(dateStr.substring(6, 8), 10)
  const hour = parseInt(dateStr.substring(9, 11), 10)
  const minute = parseInt(dateStr.substring(11, 13), 10)
  const second = parseInt(dateStr.substring(13, 15), 10)

  if (dateStr.endsWith('Z')) {
    return new Date(Date.UTC(year, month, day, hour, minute, second))
  }

  return new Date(year, month, day, hour, minute, second)
}
