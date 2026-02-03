import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DayDetailModal from '@/components/DayDetailModal';
import type { Category, Event } from '@/lib/instant';

const categories: Category[] = [
  { id: 'cat-1', name: 'Work', color: '#4f46e5', userId: 'u', createdAt: 0 },
  { id: 'cat-2', name: 'Personal', color: '#0ea5e9', userId: 'u', createdAt: 0 },
];

describe('DayDetailModal', () => {
  it('renders time labels and sorts timed events before all-day', () => {
    const events: Event[] = [
      {
        id: 'e1',
        title: 'All Day Event',
        date: '2026-02-03',
        categoryId: 'cat-1',
        userId: 'u',
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 'e2',
        title: 'Morning Meeting',
        date: '2026-02-03',
        startTime: '09:00',
        categoryId: 'cat-2',
        userId: 'u',
        createdAt: 0,
        updatedAt: 0,
      },
    ];

    const { container } = render(
      <DayDetailModal
        isOpen={true}
        onClose={() => {}}
        date={new Date(2026, 1, 3)}
        events={events}
        categories={categories}
        onEditEvent={() => {}}
        onAddEvent={() => {}}
      />
    );

    expect(screen.getByText(/Morning Meeting/)).toBeInTheDocument();
    expect(screen.getByText(/All Day Event/)).toBeInTheDocument();

    const cards = container.querySelectorAll('h3');
    expect(cards[0].textContent).toMatch(/Morning/);
  });
});
