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
      // Load Google Identity Services
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        this.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/calendar.readonly',
          callback: (response: TokenResponse) => {
            if (response.access_token) {
              this.accessToken = response.access_token;
            }
          },
        });
        this.isInitialized = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.body.appendChild(script);
    });
  }

  async signIn(): Promise<boolean> {
    try {
      await this.init();
      
      return new Promise((resolve) => {
        // Override callback for this specific request
        this.tokenClient.callback = (response: TokenResponse) => {
          if (response.access_token) {
            this.accessToken = response.access_token;
            resolve(true);
          } else {
            resolve(false);
          }
        };
        
        // Request access token
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
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

      const responses = await Promise.all(
        calendarIds.map(async (calendarId) => {
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
            throw new Error(`Failed to fetch events for calendar ${calendarId}`);
          }

          const data = await response.json();
          const items: GoogleCalendarEvent[] = data.items || [];
          return items.map((item) => ({
            ...item,
            calendarId,
          }));
        })
      );

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
        throw new Error('Failed to fetch calendars');
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Error fetching calendars:', error);
      return [];
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
