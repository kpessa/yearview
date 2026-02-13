import { CATEGORY_COLORS } from './colors';

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  colorId?: string;
  calendarId?: string;
  calendarName?: string;
}



export interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  primary?: boolean;
  selected?: boolean;
  accessRole?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  colorId?: string;
}

export class GoogleCalendarService {
  private accessToken: string | null = null;

  /**
   * Check the URL hash for an OAuth access token on page load.
   * Returns true if a token was found and extracted.
   */
  handleRedirect(): boolean {
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token')) return false;

    const params = new URLSearchParams(hash.substring(1));
    const token = params.get('access_token');
    const state = params.get('state');

    if (token && state === 'google_calendar_auth') {
      this.accessToken = token;
      // Clean the token from the URL without triggering a reload
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return true;
    }

    return false;
  }

  /**
   * Redirect the user to Google's OAuth consent page.
   * After consent, Google redirects back with the token in the URL hash.
   */
  signIn(): void {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID');
      return;
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', window.location.origin);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar');
    authUrl.searchParams.set('state', 'google_calendar_auth');
    authUrl.searchParams.set('include_granted_scopes', 'true');

    window.location.href = authUrl.toString();
  }

  async signOut() {
    if (this.accessToken) {
      // Revoke token
      await fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`, {
        method: 'POST',
      });
      this.accessToken = null;
    }
  }

  isSignedIn(): boolean {
    return !!this.accessToken;
  }

  async fetchEvents(year: number, calendarIds: string[] = ['primary']): Promise<GoogleCalendarEvent[]> {
    try {
      if (!this.accessToken) {
        throw new Error('Not signed in to Google');
      }

      if (!calendarIds.length) {
        return [];
      }

      const timeMin = new Date(year, 0, 1).toISOString();
      const timeMax = new Date(year, 11, 31, 23, 59, 59).toISOString();

      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      const MAX_RETRIES = 3;
      const results: GoogleCalendarEvent[][] = [];

      for (const calendarId of calendarIds) {
        let retries = 0;
        let success = false;

        while (!success && retries < MAX_RETRIES) {
          try {
            // Add a small delay between requests to avoid burst limit
            if (results.length > 0 && retries === 0) await delay(200);

            console.log(`Fetching events for calendar: ${calendarId} (Attempt ${retries + 1})`);
            const response = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
              `timeMin=${encodeURIComponent(timeMin)}&` +
              `timeMax=${encodeURIComponent(timeMax)}&` +
              `showDeleted=false&` +
              `singleEvents=true&` +
              `orderBy=startTime`,
              {
                headers: {
                  Authorization: `Bearer ${this.accessToken}`,
                },
              }
            );

            if (!response.ok) {
              const errorBody = await response.text();
              console.error(`Failed to fetch events for calendar ${calendarId}: ${response.status} ${response.statusText}`, errorBody);

              let isRateLimit = false;
              try {
                const errorJson = JSON.parse(errorBody);
                if (errorJson.error?.errors?.[0]?.reason === 'rateLimitExceeded' ||
                  errorBody.includes('Queries per minute') ||
                  response.status === 403) {
                  isRateLimit = true;
                  console.warn('Rate limit exceeded for Google Calendar API');
                }
              } catch (e) {
                if (response.status === 403) isRateLimit = true;
              }

              if (isRateLimit && retries < MAX_RETRIES - 1) {
                const backoff = 1000 * Math.pow(2, retries);
                console.warn(`Rate limit hit for ${calendarId}. Retrying in ${backoff}ms...`);
                await delay(backoff);
                retries++;
                continue;
              }

              throw new Error(`Failed to fetch events for calendar ${calendarId}: ${response.status} ${response.statusText} - ${errorBody}`);
            }

            const data = await response.json();
            const items: GoogleCalendarEvent[] = data.items || [];
            results.push(items.map((item) => ({
              ...item,
              calendarId,
            })));
            success = true;

          } catch (error) {
            // If we caught an error that was NOT handled by the retry logic (e.g. non-retriable error or max retries exceeded)
            // But wait, the `throw new Error` above is caught here.
            // Check if we should retry based on error type if we didn't already
            // If we already retried and failed, or if it's not a fetch/rate-limit error, we might want to give up on THIS calendar but continue others?
            // Or fail the whole batch? Original behavior was fail whole batch. Let's stick to fail whole batch for now to avoid partial state issues unless robust.
            // However, the `continue` above inside the catch would be tricky. 
            // My loop structure: try { fetch... if error throw } catch { check retry }

            // Actually, the `continue` inside `try` block (after await delay) works for the `while` loop.
            // But if I throw inside `try`, I go to `catch`.

            // Let's refactor the loop slightly to be cleaner.

            if (retries >= MAX_RETRIES - 1) throw error; // Re-throw if max retries
            // If it was a thrown Error from response !ok, we already handled retry logic inside `try` essentially? 
            // No, the `if (isRateLimit)` block executed `continue`. `continue` in `try` works? Yes.
            // But `throw` happens if `!isRateLimit` or retries exhausted.
            // So if we are in `catch`, it's network error or thrown error.

            // If it's a network error (fetch failed), we might want to retry.
            console.warn(`Network or other error fetching ${calendarId}, retrying...`, error);
            await delay(1000 * Math.pow(2, retries));
            retries++;
          }
        }
      }

      const responses = results;

      const merged = responses.flat();
      const uniqueById = new Map<string, GoogleCalendarEvent>();
      for (const item of merged) {
        const key = `${item.calendarId || 'primary'}:${item.id}`;
        if (!uniqueById.has(key)) {
          uniqueById.set(key, item);
        }
      }

      return Array.from(uniqueById.values());
    } catch (error) {
      console.error('Error fetching Google Calendar events:', error);
      return [];
    }
  }

  async getCalendars(): Promise<GoogleCalendarListEntry[]> {
    try {
      if (!this.accessToken) {
        throw new Error('Not signed in to Google');
      }

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Calendar API Error Body:', errorBody);
        throw new Error(`Failed to fetch calendars: ${response.status} ${response.statusText} - ${errorBody}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Error fetching calendars:', error);
      return [];
    }
  }


  async insertEvent(calendarId: string, event: Partial<GoogleCalendarEvent>): Promise<GoogleCalendarEvent | null> {
    if (!this.accessToken) throw new Error('Not signed in');

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to insert event');
      }

      return await response.json();
    } catch (error) {
      console.error('Error inserting event:', error);
      return null;
    }
  }

  async updateEvent(calendarId: string, eventId: string, event: Partial<GoogleCalendarEvent>): Promise<GoogleCalendarEvent | null> {
    if (!this.accessToken) throw new Error('Not signed in');

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update event');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating event:', error);
      return null;
    }
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<boolean> {
    if (!this.accessToken) throw new Error('Not signed in');

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete event');
      }

      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      return false;
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();

export function getCalendarCategoryColor(calendarId: string, fallbackIndex: number = 0): string {
  if (!calendarId) {
    const index = Math.abs(fallbackIndex) % CATEGORY_COLORS.length;
    return CATEGORY_COLORS[index].value;
  }

  let hash = 0;
  for (let i = 0; i < calendarId.length; i += 1) {
    hash = (hash * 31 + calendarId.charCodeAt(i)) | 0;
  }

  const index = Math.abs(hash) % CATEGORY_COLORS.length;
  return CATEGORY_COLORS[index].value;
}
