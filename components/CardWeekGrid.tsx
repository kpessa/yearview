'use client';

import { useMemo, useLayoutEffect, useRef, useState } from 'react';
import { Category, CustomHoliday, DayNote, Event } from '@/lib/instant';
import {
  formatDate,
  formatDateForDisplay,
  getQuarterForDate,
  getSuitForQuarter,
  getWeeksInYear,
  parseDateString,
  WeekInYear,
} from '@/lib/dateUtils';
import DayCell from './DayCell';
import { normalizeOpacity, toRgba } from '@/lib/colors';
import { getDayCellBackgroundClass } from '@/lib/dayCellStyles';

interface CardWeekGridProps {
  year: number;
  events: Event[];
  categories: Category[];
  visibleCategoryIds: Set<string>;
  customHolidays?: CustomHoliday[];
  dayNotes?: DayNote[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
  showUSHolidays?: boolean;
  showIndiaHolidays?: boolean;
  showLongWeekends?: boolean;
  showPastDatesAsGray?: boolean;
  quarter: 1 | 2 | 3 | 4;
  cardViewMode?: 'quarter' | 'continuous';
}

interface CardWeek extends WeekInYear {
  overflowDates?: Date[];
}

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export default function CardWeekGrid({
  year,
  events,
  categories,
  visibleCategoryIds,
  customHolidays = [],
  dayNotes = [],
  onDayClick,
  onEventClick,
  showUSHolidays = true,
  showIndiaHolidays = true,
  showLongWeekends = true,
  showPastDatesAsGray = true,
  quarter,
  cardViewMode = 'quarter',
}: CardWeekGridProps) {
  const [isPastCollapsed, setIsPastCollapsed] = useState(true);
  const [isFutureCollapsed, setIsFutureCollapsed] = useState(true);
  const weekRefs = useRef<Array<HTMLDivElement | null>>([]);
  // const hasAutoScrolledRef = useRef(false); // Auto-scroll is removed as collapsed state handles focus
  const visibleEvents = useMemo(() => {
    return events.filter(event => visibleCategoryIds.has(event.categoryId));
  }, [events, visibleCategoryIds]);

  const weeks = useMemo<CardWeek[]>(() => {
    const allWeeks: CardWeek[] = getWeeksInYear(year, 0).map(week => ({ ...week }));
    if (allWeeks.length <= 52) {
      const padded = [...allWeeks];
      while (padded.length < 52) {
        padded.push({ start: new Date(year, 11, 31), end: new Date(year, 11, 31), dates: [] });
      }
      return padded;
    }

    const baseWeeks = allWeeks.slice(0, 52);
    const overflowWeeks = allWeeks.slice(52);
    if (overflowWeeks.length > 0) {
      const overflowDates = overflowWeeks.flatMap(week => week.dates);
      const lastWeek = baseWeeks[51];
      baseWeeks[51] = {
        ...lastWeek,
        overflowDates,
      };
    }
    return baseWeeks;
  }, [year]);

  const displayedWeeks = useMemo(() => {
    if (cardViewMode === 'continuous') {
      return weeks;
    }
    return weeks.filter((week, index) => {
      const weekQuarter = (Math.floor(index / 13) + 1) as 1 | 2 | 3 | 4;
      return weekQuarter === quarter;
    });
  }, [weeks, quarter, cardViewMode]);

  const suit = getSuitForQuarter(quarter);
  const suitColor = suit === '♥' || suit === '♦' ? 'text-red-600' : 'text-neutral-900';
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayKey = formatDate(new Date());

  const getEventsForDate = (date: Date) => {
    const dateStr = formatDate(date);
    return visibleEvents.filter(event => {
      const eventStart = event.date;
      const eventEnd = event.endDate || event.date;
      return dateStr >= eventStart && dateStr <= eventEnd;
    });
  };

  const getWeekEvents = (weekDates: Date[]) => {
    if (weekDates.length === 0) return [];
    const weekStart = new Date(weekDates[0].getFullYear(), weekDates[0].getMonth(), weekDates[0].getDate());
    const weekEnd = new Date(weekDates[6].getFullYear(), weekDates[6].getMonth(), weekDates[6].getDate());
    const msPerDay = 24 * 60 * 60 * 1000;

    return visibleEvents
      .filter(event => {
        const eventStart = parseDateString(event.date);
        const eventEnd = event.endDate ? parseDateString(event.endDate) : eventStart;
        return eventStart <= weekEnd && eventEnd >= weekStart;
      })
      .filter(event => (event.endDate || event.date) !== event.date)
      .map(event => {
        const eventStart = parseDateString(event.date);
        const eventEnd = event.endDate ? parseDateString(event.endDate) : eventStart;
        const startIndex = Math.max(0, Math.floor((eventStart.getTime() - weekStart.getTime()) / msPerDay));
        const endIndex = Math.min(6, Math.floor((eventEnd.getTime() - weekStart.getTime()) / msPerDay));
        return {
          ...event,
          startIndex,
          endIndex,
          span: endIndex - startIndex + 1,
        };
      })
      .filter(event => event.span > 0);
  };

  const displayedWeekEvents = useMemo(() => {
    return displayedWeeks.map(week => getWeekEvents(week.dates));
  }, [displayedWeeks, visibleEvents]);

  const maxWeekEventStackHeight = useMemo(() => {
    const maxEvents = displayedWeekEvents.reduce((max, eventsForWeek) => {
      return Math.max(max, eventsForWeek.length);
    }, 0);
    return maxEvents > 0 ? 20 + (maxEvents - 1) * 18 : 0;
  }, [displayedWeekEvents]);


  // Auto-scroll logic removed to allow default "top of list" to be the current content
  /*
  useLayoutEffect(() => {
    if (hasAutoScrolledRef.current) return;
    const today = new Date();
    if (today.getFullYear() !== year) return;

    // In continuous mode, we always scroll. In quarter mode, checked quarter match
    if (cardViewMode === 'quarter') {
      const todayQuarter = getQuarterForDate(today);
      if (todayQuarter !== quarter) return;
    }

    const todayWeekIndex = displayedWeeks.findIndex(week =>
      week.dates.some(date => formatDate(date) === todayKey)
    );
    if (todayWeekIndex === -1) return;

    // Logic to scroll is still good, though we might just rely on the 'visible' logic now?
    // User wants "previous collapsed". So 'current' is naturally near the top?
    // If we collapse previous, the 'current' is likely at index 0 or 1 of the VIEWPORT.
    // So scrolling might be redundant if we collapse correctly.
    // But let's keep it to ensure it's in view if expanded.

    // However, if we collapse, the element might not exist or be hidden?
    // Wait, ref index will change.

    // Let's defer scroll logic update until after we implement the collapse render logic.
    // Actually, if we collapse past weeks, the "today" week becomes the first visible week (or close to it).
    // So distinct scrolling logic might not be needed if default is collapsed.

    // But if expanded?

  }, [displayedWeeks, quarter, todayKey, year, cardViewMode]);
  */

  return (
    <div className="pb-6 space-y-0">
      <div className="card-week-header">
        <div className="card-week-label" aria-hidden="true"></div>
        <div className="card-month-label" aria-hidden="true"></div>
        <div className="grid grid-cols-7 gap-px bg-neutral-200 overflow-hidden flex-1">
          {dayLabels.map(label => (
            <div key={label} className="card-week-day-header">
              {label}
            </div>
          ))}
        </div>
      </div>
      {displayedWeeks.map((week, index) => {
        // Calculate global week number
        // If continuous, index is correct (+1).
        // If quarter, we need offset.
        let weekNumber = index + 1;
        if (cardViewMode === 'quarter') {
          weekNumber = (quarter - 1) * 13 + index + 1;
        } else {
          // To be precise, we need to know the index in 'allWeeks'.
          // fortunately 'displayedWeeks' IS 'allWeeks' in continuous.
        }

        // Determine if this week should be shown
        // Find today's index in displayedWeeks
        const todayIndex = displayedWeeks.findIndex(w => w.dates.some(d => formatDate(d) === todayKey));

        // Visibility Logic:
        // rangeStart: todayIndex
        // rangeEnd: todayIndex + 6
        // If todayIndex is -1 (not in this view), showing behavior depends on Year?
        // If year is past, maybe collapse all into "Past"?
        // If year is future, collapse all into "Future"?

        let isVisible = true;
        let isPastGroup = false;
        let isFutureGroup = false;

        if (todayIndex !== -1) {
          if (index < todayIndex - 1) {
            // Past
            if (isPastCollapsed) isVisible = false;
            isPastGroup = true;
          } else if (index > todayIndex + 5) { // Changed from index > todayIndex + 4 to show 1 week more future
            // Future
            if (isFutureCollapsed) isVisible = false;
            isFutureGroup = true;
          }
        } else {
          // "today" is not in this view (e.g. separate quarter or different year)
          const today = new Date();
          if (year < today.getFullYear()) {
            // Past year
            if (isPastCollapsed) isVisible = false;
            isPastGroup = true;
          } else if (year > today.getFullYear()) {
            // Future year
            if (isFutureCollapsed) isVisible = false;
            isFutureGroup = true;
          } else {
            // Same year, different bucket (quarter view)
            // Start of this view vs today?
            const firstDate = week.dates[0];
            if (firstDate < today) {
              if (isPastCollapsed) isVisible = false;
              isPastGroup = true;
            } else {
              if (isFutureCollapsed) isVisible = false;
              isFutureGroup = true;
            }
          }
        }

        // Render toggles for groups
        // We only render toggle ONCE for the group.
        // Identify if this is the FIRST item of the collapsed group.

        const showPastToggle = isPastGroup && index === 0 && isPastCollapsed;
        // Future toggle needs to be rendered where? At the start of the future group?
        // Yes, first suppressed item.
        const showFutureToggle = isFutureGroup && ((todayIndex !== -1 && index === todayIndex + 6) || (todayIndex === -1 && index === 0)) && isFutureCollapsed;


        if (!isVisible) {
          if (showPastToggle) {
            return (
              <div key="past-toggle" className="card-week-stack cursor-pointer group" onClick={() => setIsPastCollapsed(false)}>
                <div className="card-week-row h-12 flex items-center justify-center bg-neutral-50 hover:bg-neutral-100 transition-colors border-b border-neutral-200">
                  <span className="text-sm font-medium text-neutral-500 group-hover:text-neutral-700 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    Show Previous Weeks
                  </span>
                </div>
              </div>
            );
          }
          if (showFutureToggle) {
            return (
              <div key="future-toggle" className="card-week-stack cursor-pointer group" onClick={() => setIsFutureCollapsed(false)}>
                <div className="card-week-row h-12 flex items-center justify-center bg-neutral-50 hover:bg-neutral-100 transition-colors border-t border-neutral-200">
                  <span className="text-sm font-medium text-neutral-500 group-hover:text-neutral-700 flex items-center gap-2">
                    Show Future Weeks
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
              </div>
            );
          }
          return null;
        }

        const rank = RANKS[index % 13] || '';
        const suitForWeek = getSuitForQuarter((Math.floor((weekNumber - 1) / 13) + 1) as 1 | 2 | 3 | 4); // Refined suit logic
        const weekSuitColor = (suitForWeek === '♥' || suitForWeek === '♦') ? 'text-red-600' : 'text-neutral-900';

        const monthChangeDate = week.dates.find(date => {
          return date.getFullYear() === year && date.getDate() === 1; // Removed quarter check for continuous mode
        });
        const monthLabel = monthChangeDate
          ? monthChangeDate.toLocaleDateString('en-US', { month: 'long' })
          : '';
        const weekEvents = displayedWeekEvents[index] || [];
        const eventStackHeight = maxWeekEventStackHeight;

        return (
          <div
            key={`${week.start.toISOString()}-${index}`}
            className="card-week-stack"
            ref={(el) => {
              weekRefs.current[index] = el;
            }}
          >
            <div className="card-week-row">
              <div className="card-week-label">
                <div className={`card-title text-base ${weekSuitColor}`}>
                  {rank} {suitForWeek}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-neutral-500">
                  W{weekNumber}
                </div>
              </div>

              <div className="card-month-label">
                {monthLabel && (
                  <span>{monthLabel}</span>
                )}
              </div>

              <div
                className="relative flex-1 card-week-grid"
                style={eventStackHeight > 0 ? { paddingBottom: `${eventStackHeight}px` } : undefined}
              >
                <div className="grid grid-cols-7 gap-px bg-neutral-200 overflow-hidden">
                  {week.dates.map((date, dayIndex) => {
                    const isOutsideYear = date.getFullYear() !== year;
                    const dayEvents = getEventsForDate(date);
                    return (
                      <div
                        key={`${formatDate(date)}-${dayIndex}`}
                        className={`h-16 ${isOutsideYear ? 'opacity-50' : ''}`}
                      >
                        <DayCell
                          date={date}
                          events={dayEvents}
                          categories={categories}
                          visibleCategoryIds={visibleCategoryIds}
                          customHolidays={customHolidays}
                          dayNotes={dayNotes}
                          onDayClick={onDayClick}
                          onEventClick={onEventClick}
                          showEventDots={false}
                          showEventCountBadge={false}
                          showSingleDayChips={true}
                          chipsBelowBars={false}
                          separateAllDayAndTimed={true}
                          showUSHolidays={showUSHolidays}
                          showIndiaHolidays={showIndiaHolidays}
                          showLongWeekends={showLongWeekends}
                          showPastDatesAsGray={showPastDatesAsGray}
                          pastDateOpacityClass="opacity-40"
                          weekendBackgroundClass="bg-neutral-200 border-r border-neutral-200"
                          currentDayAccentClass="ring-4 ring-emerald-600 ring-inset shadow-[0_0_0_2px_rgba(16,185,129,0.35)]"
                        />
                      </div>
                    );
                  })}
                </div>

                {eventStackHeight > 0 && (
                  <div
                    className="card-week-spanning-bg"
                    style={{ height: `${eventStackHeight}px` }}
                  >
                    <div className="grid grid-cols-7 gap-px bg-neutral-200 overflow-hidden h-full">
                      {week.dates.map((date, dayIndex) => {
                        const isOutsideYear = date.getFullYear() !== year;
                        return (
                          <div
                            key={`span-bg-${formatDate(date)}-${dayIndex}`}
                            className={`h-full ${getDayCellBackgroundClass(date, {
                              customHolidays,
                              dayNotes,
                              showUSHolidays,
                              showIndiaHolidays,
                              showLongWeekends,
                              showPastDatesAsGray,
                              pastDateOpacityClass: 'opacity-40',
                              weekendBackgroundClass: 'bg-neutral-200 border-r border-neutral-200',
                            })} ${isOutsideYear ? 'opacity-50' : ''}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                <div
                  className="card-week-events"
                  style={eventStackHeight > 0 ? { height: `${eventStackHeight}px` } : undefined}
                >
                  {weekEvents.map((event, eventIndex) => {
                    const category = categories.find(c => c.id === event.categoryId);
                    if (!category) return null;
                    const categoryOpacity = normalizeOpacity(category.opacity);
                    const leftPercent = (event.startIndex / 7) * 100;
                    const widthPercent = (event.span / 7) * 100;

                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                        className="card-week-event-chip"
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          bottom: `${4 + (eventIndex * 18)}px`,
                          backgroundColor: toRgba(category.color, categoryOpacity),
                        }}
                        title={event.title}
                      >
                        {event.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {week.overflowDates && week.overflowDates.length > 0 && (
              <div className="card-overflow-note">
                Overflow: {week.overflowDates.map(d => formatDateForDisplay(formatDate(d))).join(', ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
