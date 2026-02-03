import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CardWeekGrid from '@/components/CardWeekGrid';
import type { Category, Event } from '@/lib/instant';

const categories: Category[] = [
  { id: 'cat-1', name: 'Work', color: '#4f46e5', userId: 'u', createdAt: 0 },
  { id: 'cat-2', name: 'Personal', color: '#0ea5e9', userId: 'u', createdAt: 0 },
];

const baseProps = {
  year: 2026,
  events: [] as Event[],
  categories,
  visibleCategoryIds: new Set(categories.map(c => c.id)),
  customHolidays: [],
  dayNotes: [],
  onDayClick: () => {},
  onEventClick: () => {},
  showUSHolidays: false,
  showIndiaHolidays: false,
  showLongWeekends: false,
  showPastDatesAsGray: false,
};

describe('CardWeekGrid', () => {
  it('renders 13 week rows for a quarter', () => {
    const { container } = render(
      <CardWeekGrid {...baseProps} quarter={1} />
    );
    const rows = container.querySelectorAll('.card-week-row');
    expect(rows.length).toBe(13);
  });

  it('renders a spanning event bar across a week', () => {
    const events: Event[] = [
      {
        id: 'e1',
        title: 'Turning Point Go-Live',
        description: '',
        date: '2026-02-01',
        endDate: '2026-02-06',
        startTime: '09:00',
        categoryId: 'cat-1',
        userId: 'u',
        createdAt: 0,
        updatedAt: 0,
      },
    ];

    const { container } = render(
      <CardWeekGrid {...baseProps} events={events} quarter={1} />
    );

    const chips = container.querySelectorAll('.card-week-event-chip');
    expect(chips.length).toBeGreaterThan(0);
    expect(screen.getByText('Turning Point Go-Live')).toBeInTheDocument();
  });

  it('renders a time+title chip for single-day events', () => {
    const events: Event[] = [
      {
        id: 'e2',
        title: 'Test',
        description: '',
        date: '2026-02-03',
        startTime: '09:00',
        categoryId: 'cat-2',
        userId: 'u',
        createdAt: 0,
        updatedAt: 0,
      },
    ];

    render(<CardWeekGrid {...baseProps} events={events} quarter={1} />);
    expect(screen.getByText(/9:00/i)).toBeInTheDocument();
    expect(screen.getByText(/Test/)).toBeInTheDocument();
  });
});
