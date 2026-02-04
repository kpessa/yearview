'use client';

import { useState, useMemo, useEffect } from 'react';
import { db } from '@/lib/instant';
import type { Event, Category, CustomHoliday, DayNote } from '@/lib/instant';
import { getQuarterForDate } from '@/lib/dateUtils';

export interface CalendarState {
    selectedYear: number;
    setSelectedYear: (year: number) => void;
    visibleCategoryIds: Set<string>;
    setVisibleCategoryIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    isEventModalOpen: boolean;
    setIsEventModalOpen: (open: boolean) => void;
    isCategoryModalOpen: boolean;
    setIsCategoryModalOpen: (open: boolean) => void;
    isDayDetailModalOpen: boolean;
    setIsDayDetailModalOpen: (open: boolean) => void;
    isDisplayOptionsOpen: boolean;
    setIsDisplayOptionsOpen: (open: boolean) => void;
    selectedEvent: Event | null;
    setSelectedEvent: (event: Event | null) => void;
    selectedCategory: Category | null;
    setSelectedCategory: (category: Category | null) => void;
    selectedDate: Date | null;
    setSelectedDate: (date: Date | null) => void;
    viewMode: 'year' | 'cards';
    setViewMode: (mode: 'year' | 'cards') => void;
    selectedQuarter: 1 | 2 | 3 | 4;
    setSelectedQuarter: (quarter: 1 | 2 | 3 | 4) => void;
    // Display options
    showPastDatesAsGray: boolean;
    setShowPastDatesAsGray: (show: boolean) => void;
    showUSHolidays: boolean;
    setShowUSHolidays: (show: boolean) => void;
    showIndiaHolidays: boolean;
    setShowIndiaHolidays: (show: boolean) => void;
    showLongWeekends: boolean;
    setShowLongWeekends: (show: boolean) => void;
}

export interface CalendarData {
    categories: Category[];
    events: Event[];
    allEvents: Event[];
    customHolidays: CustomHoliday[];
    dayNotes: DayNote[];
    isLoading: boolean;
}

export function useCalendarState(): CalendarState {
    const currentYear = new Date().getFullYear();

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [visibleCategoryIds, setVisibleCategoryIds] = useState<Set<string>>(new Set());
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isDayDetailModalOpen, setIsDayDetailModalOpen] = useState(false);
    const [isDisplayOptionsOpen, setIsDisplayOptionsOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [viewMode, setViewMode] = useState<'year' | 'cards'>('year');
    const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(() => {
        return getQuarterForDate(new Date());
    });

    // Display options state
    const [showPastDatesAsGray, setShowPastDatesAsGray] = useState(true);
    const [showUSHolidays, setShowUSHolidays] = useState(true);
    const [showIndiaHolidays, setShowIndiaHolidays] = useState(true);
    const [showLongWeekends, setShowLongWeekends] = useState(true);

    return {
        selectedYear,
        setSelectedYear,
        visibleCategoryIds,
        setVisibleCategoryIds,
        isEventModalOpen,
        setIsEventModalOpen,
        isCategoryModalOpen,
        setIsCategoryModalOpen,
        isDayDetailModalOpen,
        setIsDayDetailModalOpen,
        isDisplayOptionsOpen,
        setIsDisplayOptionsOpen,
        selectedEvent,
        setSelectedEvent,
        selectedCategory,
        setSelectedCategory,
        selectedDate,
        setSelectedDate,
        viewMode,
        setViewMode,
        selectedQuarter,
        setSelectedQuarter,
        // Display options
        showPastDatesAsGray,
        setShowPastDatesAsGray,
        showUSHolidays,
        setShowUSHolidays,
        showIndiaHolidays,
        setShowIndiaHolidays,
        showLongWeekends,
        setShowLongWeekends,
    };
}

export function useCalendarData(selectedYear: number): CalendarData {
    const { user } = db.useAuth();

    // Server-side filtering using InstantDB where clause
    // This ensures only the user's data is fetched, improving security
    const { data, isLoading } = db.useQuery(
        user
            ? {
                categories: {
                    $: {
                        where: {
                            userId: user.id,
                        },
                    },
                },
                events: {
                    $: {
                        where: {
                            userId: user.id,
                        },
                    },
                },
                customHolidays: {
                    $: {
                        where: {
                            userId: user.id,
                        },
                    },
                },
                dayNotes: {
                    $: {
                        where: {
                            userId: user.id,
                        },
                    },
                },
            }
            : ({} as any)
    );

    const categories: Category[] = (data?.categories as Category[]) || [];
    const allEvents: Event[] = (data?.events as Event[]) || [];
    const customHolidays: CustomHoliday[] = (data?.customHolidays as CustomHoliday[]) || [];
    const dayNotes: DayNote[] = (data?.dayNotes as DayNote[]) || [];

    // Filter events for selected year (still needed for year filtering)
    const events = useMemo(() =>
        allEvents.filter(e =>
            e.date >= `${selectedYear}-01-01` && e.date <= `${selectedYear}-12-31`
        ),
        [allEvents, selectedYear]
    );

    return {
        categories,
        events,
        allEvents,
        customHolidays,
        dayNotes,
        isLoading,
    };
}

export function useVisibleCategoriesInit(
    categories: Category[],
    visibleCategoryIds: Set<string>,
    setVisibleCategoryIds: React.Dispatch<React.SetStateAction<Set<string>>>
) {
    // Initialize visible categories when categories load
    useEffect(() => {
        if (categories.length > 0 && visibleCategoryIds.size === 0) {
            setVisibleCategoryIds(new Set(categories.map(c => c.id)));
        }
    }, [categories, visibleCategoryIds.size, setVisibleCategoryIds]);
}

export function useSelectedDateEvents(
    selectedDate: Date | null,
    events: Event[]
): Event[] {
    return useMemo(() => {
        if (!selectedDate) return [];
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        // Include events where the selected date falls within the event's date range
        return events.filter(e => {
            const eventStart = e.date;
            const eventEnd = e.endDate || e.date;
            return dateStr >= eventStart && dateStr <= eventEnd;
        });
    }, [selectedDate, events]);
}
