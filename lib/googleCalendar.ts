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

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  error?: string;
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
  private tokenClient: any = null;
  private isInitialized = false;

  async init() {
    if (this.isInitialized) return;

    return new Promise<void>((resolve, reject) => {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        console.error('Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID');
        reject(new Error('Configuration Error: Google Client ID is missing'));
        return;
      }

      // Load Google Identity Services
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        try {
          this.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/calendar',
            callback: (response: TokenResponse) => {
              if (response.access_token) {
                this.accessToken = response.access_token;
              }
            },
            error_callback: (error: any) => {
              console.error('Google Identity Services Error:', error);
            }
          });
          this.isInitialized = true;
          resolve();
        } catch (e) {
          reject(e);
        }
      };
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.body.appendChild(script);
    });
  }

  async signIn(): Promise<boolean> {
    try {
      await this.init();

      return new Promise((resolve) => {
        let isResolved = false;

        // Safety timeout to prevent infinite loading state (e.g. popup blocked/closed)
        const timeoutId = setTimeout(() => {
          if (!isResolved) {
            console.warn('Google sign-in timed out');
            isResolved = true;
            resolve(false);
          }
        }, 30000); // 30 seconds

        // Override callback for this specific request
        this.tokenClient.callback = (response: TokenResponse) => {
          if (isResolved) return;
          clearTimeout(timeoutId);
          isResolved = true;

          if (response.error) {
            console.error('Google OAuth Error:', response.error);
            resolve(false);
            return;
          }

          if (response.access_token) {
            this.accessToken = response.access_token;
            resolve(true);
          } else {
            resolve(false);
          }
        };

        // Override error_callback so popup failures resolve the promise immediately
        this.tokenClient.error_callback = (error: any) => {
          if (isResolved) return;
          clearTimeout(timeoutId);
          isResolved = true;
          console.error('Google OAuth popup error:', error);
          resolve(false);
        };

        // Request access token
        try {
          this.tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch (e) {
          console.error('Failed to request access token:', e);
          if (!isResolved) {
            clearTimeout(timeoutId);
            isResolved = true;
            resolve(false);
          }
        }
      });
    } catch (error) {
      console.error('Google sign in error:', error);
      return false;
    }
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
  async trySilentSignIn(email?: string): Promise<boolean> {
    try {
      await this.init();

      return new Promise((resolve) => {
        // Override callback for this specific request
        this.tokenClient.callback = (response: TokenResponse) => {
          const hasScope = response.scope && response.scope.includes('https://www.googleapis.com/auth/calendar');

          if (response.access_token && hasScope) {
            console.log('Silent sign-in successful. Scope:', response.scope);
            this.accessToken = response.access_token;
            resolve(true);
          } else {
            console.warn('Silent sign-in failed or missing scope.', {
              hasToken: !!response.access_token,
              scope: response.scope,
              expectedScope: 'https://www.googleapis.com/auth/calendar'
            });
            resolve(false);
          }
        };

        // Handle popup/silent errors
        this.tokenClient.error_callback = (error: any) => {
          console.log('Silent sign-in not available:', error?.type || error);
          resolve(false);
        };

        // Attempt silent sign-in
        try {
          this.tokenClient.requestAccessToken({
            prompt: 'none',
            hint: email || undefined,
            login_hint: email || undefined // Try both just in case
          });
        } catch (e) {
          resolve(false);
        }
      });
    } catch (error) {
      console.error('Silent sign in error:', error);
      return false;
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
