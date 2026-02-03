import { describe, expect, it } from 'vitest';
import { getWeeksInYear, getWeekStart, getQuarterForDate, getSuitForQuarter } from '@/lib/dateUtils';
import { formatTime, sortEventsByTime } from '@/lib/eventUtils';
import type { Event } from '@/lib/instant';

describe('date utils', () => {
  it('getWeekStart returns Sunday by default', () => {
    const date = new Date(2026, 1, 3); // Feb 3, 2026 is Tuesday
    const weekStart = getWeekStart(date);
    expect(weekStart.getDay()).toBe(0);
  });

  it('getWeeksInYear returns full weeks for a year', () => {
    const weeks = getWeeksInYear(2026);
    expect(weeks.length).toBe(53);
    expect(weeks[0].dates).toHaveLength(7);
  });

  it('quarter and suit mapping are stable', () => {
    const q1 = getQuarterForDate(new Date(2026, 0, 10));
    const q2 = getQuarterForDate(new Date(2026, 4, 10));
    const q3 = getQuarterForDate(new Date(2026, 7, 10));
    const q4 = getQuarterForDate(new Date(2026, 10, 10));
    expect(getSuitForQuarter(q1)).toBe('♠');
    expect(getSuitForQuarter(q2)).toBe('♥');
    expect(getSuitForQuarter(q3)).toBe('♣');
    expect(getSuitForQuarter(q4)).toBe('♦');
  });

  it('formats time for display', () => {
    expect(formatTime('13:30')).toMatch(/1:30/);
  });

  it('sorts events by time then title', () => {
    const events: Event[] = [
      { id: '1', title: 'B', date: '2026-02-03', categoryId: 'c', userId: 'u', createdAt: 0, updatedAt: 0 },
      { id: '2', title: 'A', date: '2026-02-03', startTime: '09:00', categoryId: 'c', userId: 'u', createdAt: 0, updatedAt: 0 },
      { id: '3', title: 'C', date: '2026-02-03', startTime: '08:00', categoryId: 'c', userId: 'u', createdAt: 0, updatedAt: 0 },
    ];
    const sorted = sortEventsByTime(events);
    expect(sorted[0].id).toBe('3');
    expect(sorted[1].id).toBe('2');
    expect(sorted[2].id).toBe('1');
  });
});
