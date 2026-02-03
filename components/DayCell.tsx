'use client';

import { Event, Category, CustomHoliday, DayNote } from '@/lib/instant';
import { isToday, getDayOfWeek, formatDate } from '@/lib/dateUtils';
import { formatTimeRange, sortEventsByTime } from '@/lib/eventUtils';
import { isHoliday, isExtendedWeekend, getHolidayName, getExtendedWeekendHolidayName } from '@/lib/holidays';

interface DayCellProps {
  date: Date;
  events: Event[];
  categories: Category[];
  visibleCategoryIds: Set<string>;
  customHolidays?: CustomHoliday[];
  dayNotes?: DayNote[];
  onDayClick: (date: Date) => void;
  onEventClick?: (event: Event) => void;
  showEventDots?: boolean;
  showSingleDayChips?: boolean;
  chipsBelowBars?: boolean;
  showEventCountBadge?: boolean;
  showUSHolidays?: boolean;
  showIndiaHolidays?: boolean;
  showLongWeekends?: boolean;
  showPastDatesAsGray?: boolean;
}

export default function DayCell({
  date,
  events = [],
  visibleCategoryIds,
  categories,
  onDayClick,
  onEventClick,
  showEventDots = true,
  showSingleDayChips = false,
  chipsBelowBars = false,
  showEventCountBadge = false,
  customHolidays = [],
  dayNotes = [],
  showUSHolidays = true,
  showIndiaHolidays = true,
  showLongWeekends = true,
  showPastDatesAsGray = true,
}: DayCellProps) {
  const dayOfWeek = getDayOfWeek(date);
  const isCurrentDay = isToday(date);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6; // Sunday or Saturday
  const dateStr = formatDate(date);

  // Check if date is in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = date < today;

  // Holiday checks - only if enabled
  const isHolidayDay = isHoliday(date, customHolidays, showUSHolidays, showIndiaHolidays);
  const isExtendedWeekendDay = showLongWeekends && isExtendedWeekend(date, customHolidays, showUSHolidays, showIndiaHolidays);
  const holidayName = getHolidayName(date, customHolidays, showUSHolidays, showIndiaHolidays);
  const extendedWeekendName = showLongWeekends ? getExtendedWeekendHolidayName(date, customHolidays, showUSHolidays, showIndiaHolidays) : null;

  // Check for day note highlight
  const dayNote = dayNotes.find(n => n.date === dateStr);
  const isHighlighted = dayNote?.isHighlighted;

  const visibleEvents = events.filter(event => visibleCategoryIds.has(event.categoryId));
  const dayEvents = visibleEvents.filter(event => {
    const eventStart = event.date;
    const eventEnd = event.endDate || event.date;
    return dateStr >= eventStart && dateStr <= eventEnd;
  });
  const singleDayEvents = sortEventsByTime(
    dayEvents.filter(event => (event.endDate || event.date) === event.date)
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onDayClick(date);
    }
  };

  // Determine background color based on priority
  const getBackgroundClass = () => {
    if (isCurrentDay) return 'bg-green-50 border border-green-600';
    if (isHolidayDay) return 'bg-red-100 border-r border-red-200';
    if (isHighlighted) return 'bg-blue-50 border-r border-blue-200';
    if (isExtendedWeekendDay) return 'bg-red-50 border-r border-red-100';
    if (isWeekend) return 'bg-neutral-100 border-r border-neutral-100';
    return 'bg-white border-r border-neutral-100';
  };

  // Determine text color based on priority
  const getTextClass = () => {
    if (isCurrentDay) return 'text-green-600 font-semibold';
    if (isHolidayDay) return 'text-red-700 font-semibold';
    if (isExtendedWeekendDay) return 'text-red-600';
    if (isHighlighted) return 'text-blue-700 font-medium';
    if (isWeekend) return 'text-neutral-500';
    return 'text-neutral-700';
  };

  // Build tooltip/title
  const getTitle = () => {
    const baseTitle = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (holidayName) return `${baseTitle} - ${holidayName}`;
    if (extendedWeekendName) return `${baseTitle} - ${extendedWeekendName}`;
    return baseTitle;
  };

  // Apply past date styling
  const pastOpacity = isPast && showPastDatesAsGray && !isCurrentDay ? 'opacity-50' : '';

  return (
    <div
      onClick={() => onDayClick(date)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={getTitle()}
      title={holidayName || extendedWeekendName || undefined}
      data-day-cell
      data-date={dateStr}
      className={`
        relative transition-colors duration-200 cursor-pointer
        h-full hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500
        ${getBackgroundClass()} ${pastOpacity}
      `}
    >
      <div className="px-1 py-1">
          <div className={`text-[10px] font-normal ${getTextClass()}`}>
            <div className="flex items-start justify-between">
              <span>{date.getDate()}</span>
              <span className="text-[8px] opacity-60">{dayOfWeek}</span>
            </div>
            {showEventCountBadge && dayEvents.length > 0 && (
              <div className="mt-0.5 flex justify-end">
                <span className="px-1.5 py-0.5 rounded-full bg-neutral-200 text-[8px] text-neutral-600 leading-none">
                  {dayEvents.length}
                </span>
              </div>
            )}
            {(dayNote?.note || holidayName) && (
              <div className={`text-[7px] font-medium truncate mt-0.5 leading-tight ${dayNote?.note ? 'text-blue-700' : 'text-red-600'}`}>
                {dayNote?.note || holidayName}
              </div>
            )}
            {showSingleDayChips && singleDayEvents.length > 0 && (
              <div className={`mt-0.5 space-y-0.5 day-chip-stack ${chipsBelowBars ? 'day-chip-stack--lower' : ''}`}>
                {singleDayEvents.slice(0, 2).map(event => {
                  const category = categories.find(c => c.id === event.categoryId);
                  return (
                    <button
                      key={event.id}
                      type="button"
                      className="day-chip"
                      style={{ backgroundColor: category?.color || '#9ca3af' }}
                      onClick={(e) => {
                        if (!onEventClick) return;
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                      title={event.title}
                    >
                      {formatTimeRange(event)} {event.title}
                    </button>
                  );
                })}
                {singleDayEvents.length > 2 && (
                  <span className="text-[7px] text-neutral-500">+{singleDayEvents.length - 2}</span>
                )}
              </div>
            )}
          {dayEvents.length > 0 && (
            showEventDots ? (
              <div className="mt-0.5 flex items-center gap-0.5 flex-wrap">
                {dayEvents.slice(0, 3).map(event => {
                  const category = categories.find(c => c.id === event.categoryId);
                  return (
                    <button
                      key={event.id}
                      type="button"
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: category?.color || '#9ca3af' }}
                      title={event.title}
                      onClick={(e) => {
                        if (!onEventClick) return;
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                    />
                  );
                })}
                {dayEvents.length > 3 && (
                  <span className="text-[7px] text-neutral-500">+{dayEvents.length - 3}</span>
                )}
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
