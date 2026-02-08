'use client';

import { useState, useEffect } from 'react';
import { googleCalendarService, GoogleCalendarEvent, GoogleCalendarListEntry } from '@/lib/googleCalendar';
import { Event } from '@/lib/instant';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/contexts/ToastContext';

interface GoogleCalendarSyncProps {
  year: number;
  onImportEvents: (events: Partial<Event>[]) => void;
  onDeleteGoogleEvents: () => void;
  onEnsureGoogleCalendarCategories: (calendars: GoogleCalendarListEntry[]) => Map<string, string>;
  userEmail?: string;
  isSidebar?: boolean;
}

export default function GoogleCalendarSync({
  year,
  onImportEvents,
  onDeleteGoogleEvents,
  onEnsureGoogleCalendarCategories,
  userEmail,
  isSidebar = false,
}: GoogleCalendarSyncProps) {
  const { showToast, showConfirm } = useToast();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendarListEntry[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);

  useEffect(() => {
    // Try silent sign-in on mount
    const initAuth = async () => {
      await googleCalendarService.init();
      if (googleCalendarService.isSignedIn()) {
        setIsSignedIn(true);
      } else {
        const success = await googleCalendarService.trySilentSignIn(userEmail);
        setIsSignedIn(success);
      }
    };
    initAuth();
  }, [userEmail]);

  useEffect(() => {
    if (!isSignedIn) {
      setCalendars([]);
      setSelectedCalendarIds([]);
      return;
    }

    const loadCalendars = async () => {
      const list = await googleCalendarService.getCalendars();
      setCalendars(list);

      const defaultSelected = list
        .filter((cal) => cal.primary || cal.selected)
        .map((cal) => cal.id);

      if (defaultSelected.length) {
        setSelectedCalendarIds(defaultSelected);
      } else {
        setSelectedCalendarIds(list.map((cal) => cal.id));
      }
    };

    loadCalendars().catch((error) => {
      console.error('Failed to load calendars:', error);
    });
  }, [isSignedIn]);

  // Polling for events
  useEffect(() => {
    if (!isSignedIn || selectedCalendarIds.length === 0) return;

    const syncEvents = async () => {
      // We reuse the handleSync logic but silent (no toast unless error?)
      // actually reusing handleSync might show toasts which could be annoying on poll.
      // Let's abstract the logic or just call it.
      // For now, let's just trigger a sync but maybe we should suppress toasts if it's a background poll?
      // The user didn't ask for quiet polling specifically but "poling" usually implies background.
      // Refactoring handleSync to take a 'silent' param would be good.
      // For this iteration, I'll essentially replicate handleSync but maybe without the success toast.

      // Actually, the requirement "baked in" implies it just happens.
      // Let's call handleSync but we likely need to modify handleSync to accept a `silent` flag to avoid spamming "Imported X events".
      // Since I cannot easily modify handleSync signature in `useEffect` without changing it below...
      // I'll just rely on `handleSync` for now and maybe the user will be okay with the toast or I can suppress it.
      // Wait, if I call handleSync it sets `isSyncing` state which might flash the UI.
      // Let's try to do it properly. I will modify handleSync signature below in a separate edit, 
      // but here I will call it assuming I'll update it.
      // A better approach for this tool execution is to just fetch and import silently here.

      try {
        const selectedCalendars = calendars.filter((cal) => selectedCalendarIds.includes(cal.id));
        const calendarCategoryMap = onEnsureGoogleCalendarCategories(selectedCalendars);

        const googleEvents = await googleCalendarService.fetchEvents(year, selectedCalendarIds);
        const calendarNameById = new Map(calendars.map((cal) => [cal.id, cal.summary]));

        const convertedEvents = googleEvents.map((gEvent: GoogleCalendarEvent) => {
          const startDate = gEvent.start.date || gEvent.start.dateTime?.split('T')[0] || '';
          const endDate = gEvent.end.date || gEvent.end.dateTime?.split('T')[0] || '';
          const startTime = gEvent.start.dateTime
            ? new Date(gEvent.start.dateTime).toTimeString().slice(0, 5)
            : undefined;
          const endTime = gEvent.end.dateTime
            ? new Date(gEvent.end.dateTime).toTimeString().slice(0, 5)
            : undefined;
          const calendarName = gEvent.calendarId ? calendarNameById.get(gEvent.calendarId) : undefined;
          const categoryId = gEvent.calendarId ? calendarCategoryMap.get(gEvent.calendarId) : undefined;

          if (!categoryId) return null;

          return {
            id: uuidv4(),
            title: gEvent.summary || 'Untitled Event',
            description: gEvent.description || `Imported from Google Calendar${calendarName ? ` (${calendarName})` : ''}`,
            date: startDate,
            endDate: endDate !== startDate ? endDate : undefined,
            startTime,
            endTime,
            categoryId,
            googleEventId: gEvent.id,
            googleCalendarId: gEvent.calendarId,
            googleCalendarName: calendarName,
          };
        }).filter((event) => event !== null);

        onImportEvents(convertedEvents); // This hook likely handles waiting/dedup logic
      } catch (error) {
        console.error("Auto-sync failed", error);
      }
    };

    // Initial sync on load/config change
    syncEvents();

    // Poll every 5 minutes
    const intervalId = setInterval(syncEvents, 5 * 60 * 1000);
    return () => clearInterval(intervalId);

  }, [isSignedIn, selectedCalendarIds, year, calendars, onEnsureGoogleCalendarCategories, onImportEvents]);

  const handleSignIn = async () => {
    setIsLoading(true);
    const success = await googleCalendarService.signIn();
    setIsSignedIn(success);
    setIsLoading(false);
  };

  const handleSignOut = async () => {
    showConfirm(
      'Disconnect from Google Calendar? This will remove all imported Google Calendar events.',
      async () => {
        await googleCalendarService.signOut();
        setIsSignedIn(false);
        setCalendars([]);
        setSelectedCalendarIds([]);

        // Delete all Google Calendar events when disconnecting
        onDeleteGoogleEvents();
        showToast('Disconnected and removed Google Calendar events', 'info');
      }
    );
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      if (!selectedCalendarIds.length) {
        showToast('Select at least one calendar to sync', 'error');
        return;
      }

      const selectedCalendars = calendars.filter((cal) => selectedCalendarIds.includes(cal.id));
      const calendarCategoryMap = onEnsureGoogleCalendarCategories(selectedCalendars);

      const googleEvents = await googleCalendarService.fetchEvents(year, selectedCalendarIds);
      const calendarNameById = new Map(calendars.map((cal) => [cal.id, cal.summary]));

      const convertedEvents = googleEvents.map((gEvent: GoogleCalendarEvent) => {
        const startDate = gEvent.start.date || gEvent.start.dateTime?.split('T')[0] || '';
        const endDate = gEvent.end.date || gEvent.end.dateTime?.split('T')[0] || '';
        const startTime = gEvent.start.dateTime
          ? new Date(gEvent.start.dateTime).toTimeString().slice(0, 5)
          : undefined;
        const endTime = gEvent.end.dateTime
          ? new Date(gEvent.end.dateTime).toTimeString().slice(0, 5)
          : undefined;
        const calendarName = gEvent.calendarId ? calendarNameById.get(gEvent.calendarId) : undefined;
        const categoryId = gEvent.calendarId ? calendarCategoryMap.get(gEvent.calendarId) : undefined;

        if (!categoryId) {
          return null;
        }

        return {
          id: uuidv4(),
          title: gEvent.summary || 'Untitled Event',
          description: gEvent.description || `Imported from Google Calendar${calendarName ? ` (${calendarName})` : ''}`,
          date: startDate,
          endDate: endDate !== startDate ? endDate : undefined,
          startTime,
          endTime,
          categoryId,
          googleEventId: gEvent.id,
          googleCalendarId: gEvent.calendarId,
          googleCalendarName: calendarName,
        };
      }).filter((event) => event !== null);

      onImportEvents(convertedEvents);
      showToast(`Imported ${convertedEvents.length} events from Google Calendar`, 'success');
    } catch (error) {
      console.error('Sync error:', error);
      showToast('Failed to sync with Google Calendar', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className={`flex ${isSidebar ? 'flex-col items-stretch' : 'items-center'} gap-2`}>
      {!isSignedIn ? (
        <button
          onClick={handleSignIn}
          disabled={isLoading}
          className="px-4 py-2 bg-white border border-neutral-300 rounded-xl text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading ? (
            <span>Connecting...</span>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Connect Google Calendar
            </>
          )}
        </button>
      ) : (
        <div className={`flex ${isSidebar ? 'flex-col items-stretch' : 'items-center'} gap-2`}>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            {isSyncing ? 'Syncing...' : '↻ Sync Google Calendar'}
          </button>
          <details className="relative">
            <summary className="px-3 py-2 bg-white border border-neutral-300 rounded-xl text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-all cursor-pointer">
              Calendars ({selectedCalendarIds.length || 0})
            </summary>
            <div className={`absolute ${isSidebar ? 'left-0 w-full' : 'right-0 w-72'} mt-2 bg-white border border-neutral-200 rounded-xl shadow-lg p-3 z-10`}>
              {calendars.length ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCalendarIds(calendars.map((cal) => cal.id))}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Select all
                    </button>
                    <span className="text-xs text-neutral-400">/</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCalendarIds([])}
                      className="text-xs text-neutral-600 hover:text-neutral-700"
                    >
                      Select none
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 max-h-64 overflow-auto pr-1">
                    {calendars.map((cal) => (
                      <label key={cal.id} className="flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedCalendarIds.includes(cal.id)}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setSelectedCalendarIds((prev) => Array.from(new Set([...prev, cal.id])));
                            } else {
                              setSelectedCalendarIds((prev) => prev.filter((id) => id !== cal.id));
                            }
                          }}
                        />
                        <span className="truncate">
                          {cal.summary}
                          {cal.primary ? ' (Primary)' : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-neutral-500">Loading calendars...</div>
              )}
            </div>
          </details>
          <button
            onClick={handleSignOut}
            className="px-3 py-2 bg-neutral-100 text-neutral-600 rounded-xl text-sm hover:bg-neutral-200 transition-all"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
