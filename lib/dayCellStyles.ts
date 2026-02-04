import type { CustomHoliday, DayNote } from '@/lib/instant';
import { formatDate, isToday } from '@/lib/dateUtils';
import { isExtendedWeekend, isHoliday } from '@/lib/holidays';

interface DayCellStyleOptions {
  customHolidays?: CustomHoliday[];
  dayNotes?: DayNote[];
  showUSHolidays?: boolean;
  showIndiaHolidays?: boolean;
  showLongWeekends?: boolean;
  showPastDatesAsGray?: boolean;
  pastDateOpacityClass?: string;
  weekendBackgroundClass?: string;
}


export function getDayCellBackgroundClass(
  date: Date,
  {
    customHolidays = [],
    dayNotes = [],
    showUSHolidays = true,
    showIndiaHolidays = true,
    showLongWeekends = true,
    showPastDatesAsGray = true,
    pastDateOpacityClass = 'opacity-50',
    weekendBackgroundClass = 'bg-neutral-100 border-r border-neutral-100',
  }: DayCellStyleOptions,
): string {
  const isCurrentDay = isToday(date);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const dateStr = formatDate(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = date < today;
  const isHolidayDay = isHoliday(date, customHolidays, showUSHolidays, showIndiaHolidays);
  const isExtendedWeekendDay = showLongWeekends && isExtendedWeekend(date, customHolidays, showUSHolidays, showIndiaHolidays);
  const dayNote = dayNotes.find(n => n.date === dateStr);
  const isHighlighted = dayNote?.isHighlighted;
  const pastOpacity = isPast && showPastDatesAsGray && !isCurrentDay ? pastDateOpacityClass : '';

  let backgroundClass = 'bg-white border-r border-neutral-100';
  if (isCurrentDay) backgroundClass = 'bg-green-50 border border-green-600';
  else if (isHolidayDay) backgroundClass = 'bg-red-100 border-r border-red-200';
  else if (isHighlighted) backgroundClass = 'bg-blue-50 border-r border-blue-200';
  else if (isExtendedWeekendDay) backgroundClass = 'bg-red-50 border-r border-red-100';
  else if (isWeekend) backgroundClass = weekendBackgroundClass;

  return `${backgroundClass} ${pastOpacity}`.trim();
}
