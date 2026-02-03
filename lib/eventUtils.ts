import type { Event } from '@/lib/instant';

export function formatTime(time?: string): string {
  if (!time) return '';
  const [hoursStr, minutesStr] = time.split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatTimeRange(event: Event): string {
  if (!event.startTime) return 'All day';
  const start = formatTime(event.startTime);
  if (event.endTime) {
    const end = formatTime(event.endTime);
    return `${start}–${end}`;
  }
  return start;
}

export function sortEventsByTime(events: Event[]): Event[] {
  return [...events].sort((a, b) => {
    const aTimed = !!a.startTime;
    const bTimed = !!b.startTime;
    if (aTimed !== bTimed) return aTimed ? -1 : 1;
    if (aTimed && bTimed) {
      if (a.startTime! < b.startTime!) return -1;
      if (a.startTime! > b.startTime!) return 1;
    }
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();
    if (aTitle < bTitle) return -1;
    if (aTitle > bTitle) return 1;
    return 0;
  });
}
