'use client';

import { useMemo, useLayoutEffect, useRef } from 'react';
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
}: CardWeekGridProps) {
  const weekRefs = useRef<Array<HTMLDivElement | null>>([]);
  const hasAutoScrolledRef = useRef(false);
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

  const quarterWeeks = useMemo(() => {
    return weeks.filter((week, index) => {
      const weekQuarter = (Math.floor(index / 13) + 1) as 1 | 2 | 3 | 4;
      return weekQuarter === quarter;
    });
  }, [weeks, quarter]);

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

  const quarterWeekEvents = useMemo(() => {
    return quarterWeeks.map(week => getWeekEvents(week.dates));
  }, [quarterWeeks, visibleEvents]);

  const maxWeekEventStackHeight = useMemo(() => {
    const maxEvents = quarterWeekEvents.reduce((max, eventsForWeek) => {
      return Math.max(max, eventsForWeek.length);
    }, 0);
    return maxEvents > 0 ? 20 + (maxEvents - 1) * 18 : 0;
  }, [quarterWeekEvents]);


  useLayoutEffect(() => {
    if (hasAutoScrolledRef.current) return;
    const today = new Date();
    if (today.getFullYear() !== year) return;
    const todayQuarter = getQuarterForDate(today);
    if (todayQuarter !== quarter) return;

    const todayWeekIndex = quarterWeeks.findIndex(week =>
      week.dates.some(date => formatDate(date) === todayKey)
    );
    if (todayWeekIndex === -1) return;

    const targetIndex = Math.max(0, todayWeekIndex - 2);
    const targetEl = weekRefs.current[targetIndex];
    if (!targetEl) return;

    hasAutoScrolledRef.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        targetEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    });
  }, [quarterWeeks, quarter, todayKey, year]);

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
      {quarterWeeks.map((week, index) => {
        const rank = RANKS[index] || '';
        const weekNumber = (quarter - 1) * 13 + index + 1;
        const monthChangeDate = week.dates.find(date => {
          return date.getFullYear() === year && date.getDate() === 1 && getQuarterForDate(date) === quarter;
        });
        const monthLabel = monthChangeDate
          ? monthChangeDate.toLocaleDateString('en-US', { month: 'long' })
          : '';
        const weekEvents = quarterWeekEvents[index] || [];
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
                <div className={`card-title text-base ${suitColor}`}>
                  {rank} {suit}
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
