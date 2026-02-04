'use client';

import { useCallback } from 'react';
import { db } from '@/lib/instant';
import { v4 as uuidv4 } from 'uuid';
import type { Event, Category, CustomHoliday, DayNote } from '@/lib/instant';
import { useToast } from '@/contexts/ToastContext';
import type { CalendarState } from './useCalendarState';
import type { GoogleCalendarListEntry } from '@/lib/googleCalendar';
import { getCalendarCategoryColor } from '@/lib/googleCalendar';

export function useCalendarActions(
    state: CalendarState,
    categories: Category[],
    events: Event[]
) {
    const { user } = db.useAuth();
    const { showToast, showConfirm } = useToast();

    const handleSaveEvent = useCallback((eventData: Partial<Event>) => {
        if (!user) return;

        try {
            if (eventData.id) {
                // Update existing event
                (db.transact as any)(
                    (db.tx as any).events[eventData.id].update({
                        title: eventData.title!,
                        description: eventData.description,
                        date: eventData.date!,
                        endDate: eventData.endDate,
                        startTime: eventData.startTime,
                        endTime: eventData.endTime,
                        categoryId: eventData.categoryId!,
                        updatedAt: Date.now(),
                    })
                );
                showToast('Event updated successfully', 'success');
            } else {
                // Create new event
                const newEvent = {
                    id: uuidv4(),
                    title: eventData.title!,
                    description: eventData.description,
                    date: eventData.date!,
                    endDate: eventData.endDate,
                    startTime: eventData.startTime,
                    endTime: eventData.endTime,
                    categoryId: eventData.categoryId!,
                    userId: user.id,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };
                (db.transact as any)((db.tx as any).events[newEvent.id].update(newEvent));
                showToast('Event created successfully', 'success');
            }
        } catch (error) {
            showToast('Failed to save event', 'error');
            console.error('Error saving event:', error);
        }
    }, [user, showToast]);

    const handleDeleteEvent = useCallback((eventId: string) => {
        try {
            (db.transact as any)((db.tx as any).events[eventId].delete());
            showToast('Event deleted', 'info');
        } catch (error) {
            showToast('Failed to delete event', 'error');
            console.error('Error deleting event:', error);
        }
    }, [showToast]);

    const handleSaveCategory = useCallback((categoryData: Partial<Category>) => {
        if (!user) return;

        try {
            if (categoryData.id) {
                // Update existing category
                (db.transact as any)(
                    (db.tx as any).categories[categoryData.id].update({
                        name: categoryData.name!,
                        color: categoryData.color!,
                        opacity: categoryData.opacity ?? 1,
                    })
                );
                showToast('Category updated successfully', 'success');
            } else {
                // Create new category
                const newCategory = {
                    id: uuidv4(),
                    name: categoryData.name!,
                    color: categoryData.color!,
                    opacity: categoryData.opacity ?? 1,
                    userId: user.id,
                    createdAt: Date.now(),
                };
                (db.transact as any)((db.tx as any).categories[newCategory.id].update(newCategory));
                state.setVisibleCategoryIds(prev => new Set([...prev, newCategory.id]));
                showToast('Category created successfully', 'success');
            }
        } catch (error) {
            showToast('Failed to save category', 'error');
            console.error('Error saving category:', error);
        }
    }, [user, state, showToast]);

    const handleDeleteCategory = useCallback((categoryId: string) => {
        // Find events that belong to this category
        const categoryEvents = events.filter(e => e.categoryId === categoryId);
        const eventCount = categoryEvents.length;

        const message = eventCount > 0
            ? `This will delete the category and ${eventCount} event${eventCount > 1 ? 's' : ''} in it. Continue?`
            : 'Are you sure you want to delete this category?';

        showConfirm(message, () => {
            try {
                // Delete all events in this category first
                categoryEvents.forEach(event => {
                    (db.transact as any)((db.tx as any).events[event.id].delete());
                });

                // Then delete the category
                (db.transact as any)((db.tx as any).categories[categoryId].delete());

                state.setVisibleCategoryIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(categoryId);
                    return newSet;
                });

                const successMsg = eventCount > 0
                    ? `Category and ${eventCount} event${eventCount > 1 ? 's' : ''} deleted`
                    : 'Category deleted';
                showToast(successMsg, 'info');
            } catch (error) {
                showToast('Failed to delete category', 'error');
                console.error('Error deleting category:', error);
            }
        });
    }, [events, state, showToast, showConfirm]);

    const handleImportGoogleEvents = useCallback((googleEvents: Partial<Event>[]) => {
        if (!user) return;

        try {
            let addedCount = 0;
            let linkedCount = 0;

            const existingByGoogleKey = new Map<string, Event>();
            const legacySignatureIndex = new Map<string, Event>();

            events.forEach(existing => {
                if (existing.googleEventId) {
                    const key = `${existing.googleCalendarId || 'primary'}:${existing.googleEventId}`;
                    existingByGoogleKey.set(key, existing);
                }

                if (!existing.googleEventId) {
                    const signature = `${existing.title}::${existing.date}::${existing.endDate || ''}`;
                    if (!legacySignatureIndex.has(signature)) {
                        legacySignatureIndex.set(signature, existing);
                    }
                }
            });

            googleEvents.forEach(eventData => {
                if (!eventData.googleEventId || !eventData.categoryId) return;

                // 1. Check if event already exists by googleEventId
                const existingKey = `${eventData.googleCalendarId || 'primary'}:${eventData.googleEventId}`;
                const existingByGoogleId = existingByGoogleKey.get(existingKey);

                if (existingByGoogleId) {
                    // Event already exists and is linked. 
                    // We skip it as per "Existing events shouldn't be fetched again"
                    return;
                }

                // 2. Check for legacy match (same category, title, dates, but NO googleEventId)
                // This prevents duplicating events imported before we started tracking googleEventId
                const signature = `${eventData.title}::${eventData.date}::${eventData.endDate || ''}`;
                const legacyMatch = legacySignatureIndex.get(signature);

                if (legacyMatch) {
                    // Link the legacy event to this Google event
                    (db.transact as any)((db.tx as any).events[legacyMatch.id].update({
                        googleEventId: eventData.googleEventId,
                        googleCalendarId: eventData.googleCalendarId,
                        googleCalendarName: eventData.googleCalendarName,
                        categoryId: eventData.categoryId,
                        updatedAt: Date.now(),
                        // We could update other fields here if we wanted to enforce sync,
                        // but sticking to "only new" preference, we'll minimal touch.
                    }));
                    linkedCount++;
                    return;
                }

                // 3. Create new event
                // eventData.id was generated by uuidv4() in the caller
                const newEvent = {
                    id: eventData.id!,
                    title: eventData.title!,
                    description: eventData.description,
                    date: eventData.date!,
                    endDate: eventData.endDate,
                    categoryId: eventData.categoryId!,
                    userId: user.id,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    googleEventId: eventData.googleEventId,
                    googleCalendarId: eventData.googleCalendarId,
                    googleCalendarName: eventData.googleCalendarName,
                };
                (db.transact as any)((db.tx as any).events[newEvent.id].update(newEvent));
                addedCount++;
            });

            if (addedCount > 0 || linkedCount > 0) {
                showToast(`Synced: ${addedCount} new, ${linkedCount} linked.`, 'success');
            } else {
                showToast('No new events to sync.', 'info');
            }
        } catch (error) {
            showToast('Failed to import Google Calendar events', 'error');
            console.error('Error importing events:', error);
        }
    }, [user, events, showToast]);

    const handleEnsureGoogleCalendarCategories = useCallback((calendars: GoogleCalendarListEntry[]) => {
        const map = new Map<string, string>();
        if (!user) return map;

        const existingByCalendarId = new Map(
            categories
                .filter(category => category.googleCalendarId)
                .map(category => [category.googleCalendarId as string, category])
        );

        calendars.forEach((calendar, index) => {
            const existing = existingByCalendarId.get(calendar.id);
            if (existing) {
                map.set(calendar.id, existing.id);
                return;
            }

            const color = calendar.backgroundColor || getCalendarCategoryColor(calendar.id, index);
            const newCategory: Category = {
                id: uuidv4(),
                name: calendar.summary || 'Google Calendar',
                color,
                opacity: 1,
                userId: user.id,
                createdAt: Date.now(),
                googleCalendarId: calendar.id,
                googleCalendarName: calendar.summary,
                googleCalendarPrimary: !!calendar.primary,
            };

            (db.transact as any)((db.tx as any).categories[newCategory.id].update(newCategory));
            map.set(calendar.id, newCategory.id);
            state.setVisibleCategoryIds(prev => new Set([...prev, newCategory.id]));
        });

        return map;
    }, [user, categories, state]);

    const handleEnsureGoogleCategoriesFromEvents = useCallback(() => {
        if (!user) return;

        const googleEvents = events.filter(event => event.googleCalendarId);
        if (googleEvents.length === 0) return;

        const existingByCalendarId = new Map(
            categories
                .filter(category => category.googleCalendarId)
                .map(category => [category.googleCalendarId as string, category])
        );

        const createdMap = new Map<string, string>();
        let fallbackIndex = 0;

        googleEvents.forEach(event => {
            const calendarId = event.googleCalendarId as string;
            if (existingByCalendarId.has(calendarId) || createdMap.has(calendarId)) return;

            const name = event.googleCalendarName || 'Google Calendar';
            const newCategory: Category = {
                id: uuidv4(),
                name,
                color: getCalendarCategoryColor(calendarId, fallbackIndex),
                opacity: 1,
                userId: user.id,
                createdAt: Date.now(),
                googleCalendarId: calendarId,
                googleCalendarName: name,
                googleCalendarPrimary: false,
            };

            fallbackIndex += 1;
            (db.transact as any)((db.tx as any).categories[newCategory.id].update(newCategory));
            createdMap.set(calendarId, newCategory.id);
            state.setVisibleCategoryIds(prev => new Set([...prev, newCategory.id]));
        });

        const calendarIdToCategoryId = new Map<string, string>([
            ...existingByCalendarId.entries(),
            ...createdMap.entries(),
        ].map(([calendarId, category]) => [calendarId, typeof category === 'string' ? category : category.id]));

        googleEvents.forEach(event => {
            const calendarId = event.googleCalendarId as string;
            const targetCategoryId = calendarIdToCategoryId.get(calendarId);
            if (!targetCategoryId) return;
            if (event.categoryId === targetCategoryId) return;

            (db.transact as any)(
                (db.tx as any).events[event.id].update({
                    categoryId: targetCategoryId,
                    updatedAt: Date.now(),
                })
            );
        });
    }, [user, events, categories, state]);

    const handleDeduplicateGoogleEvents = useCallback(() => {
        if (!user) return;
        if (events.length === 0) return;

        const googleCategoryIds = new Set(
            categories.filter(category => category.googleCalendarId).map(category => category.id)
        );
        const byGoogleId = new Map<string, Event[]>();
        const byExactSignature = new Map<string, Event[]>();

        events.forEach(event => {
            const isGoogleLinked = !!event.googleEventId || !!event.googleCalendarId || googleCategoryIds.has(event.categoryId);
            if (!isGoogleLinked) return;

            if (event.googleEventId) {
                const key = `${event.googleCalendarId || 'primary'}:${event.googleEventId}`;
                const bucket = byGoogleId.get(key) || [];
                bucket.push(event);
                byGoogleId.set(key, bucket);
            }

            const signature = [
                event.categoryId,
                event.title,
                event.date,
                event.endDate || '',
                event.startTime || '',
                event.endTime || '',
            ].join('::');
            const sigBucket = byExactSignature.get(signature) || [];
            sigBucket.push(event);
            byExactSignature.set(signature, sigBucket);
        });

        const deleteDuplicates = (bucket: Event[]) => {
            if (bucket.length <= 1) return;
            const sorted = [...bucket].sort((a, b) => {
                const aHasGoogleId = a.googleEventId ? 1 : 0;
                const bHasGoogleId = b.googleEventId ? 1 : 0;
                if (aHasGoogleId !== bHasGoogleId) return bHasGoogleId - aHasGoogleId;
                return a.createdAt - b.createdAt;
            });
            sorted.slice(1).forEach(duplicate => {
                (db.transact as any)((db.tx as any).events[duplicate.id].delete());
            });
        };

        byGoogleId.forEach(deleteDuplicates);
        byExactSignature.forEach(deleteDuplicates);
    }, [user, events, categories]);

    const handleToggleCategory = useCallback((categoryId: string) => {
        state.setVisibleCategoryIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryId)) {
                newSet.delete(categoryId);
            } else {
                newSet.add(categoryId);
            }
            return newSet;
        });
    }, [state]);

    const handleDayClick = useCallback((date: Date) => {
        state.setSelectedDate(date);
        state.setIsDayDetailModalOpen(true);
    }, [state]);

    const handleAddEvent = useCallback(() => {
        state.setSelectedEvent(null);
        state.setIsEventModalOpen(true);
    }, [state]);

    const handleEditEvent = useCallback((event: Event) => {
        state.setSelectedEvent(event);
        state.setIsEventModalOpen(true);
        state.setIsDayDetailModalOpen(false);
    }, [state]);

    const handleAddCategory = useCallback(() => {
        state.setSelectedCategory(null);
        state.setIsCategoryModalOpen(true);
    }, [state]);

    const handleEditCategory = useCallback((category: Category) => {
        state.setSelectedCategory(category);
        state.setIsCategoryModalOpen(true);
    }, [state]);

    const handleCloseEventModal = useCallback(() => {
        state.setIsEventModalOpen(false);
        state.setSelectedEvent(null);
    }, [state]);

    const handleCloseCategoryModal = useCallback(() => {
        state.setIsCategoryModalOpen(false);
        state.setSelectedCategory(null);
    }, [state]);

    const handleCloseDayDetailModal = useCallback(() => {
        state.setIsDayDetailModalOpen(false);
        state.setSelectedDate(null);
    }, [state]);

    const handleDeleteGoogleEvents = useCallback(() => {
        try {
            // Delete all events linked to Google calendars
            const googleEvents = events.filter(e => e.googleCalendarId);
            googleEvents.forEach(event => {
                (db.transact as any)((db.tx as any).events[event.id].delete());
            });

            // Delete Google calendar categories
            const googleCategories = categories.filter(category => category.googleCalendarId);
            googleCategories.forEach(category => {
                (db.transact as any)((db.tx as any).categories[category.id].delete());
            });

            state.setVisibleCategoryIds(prev => {
                const newSet = new Set(prev);
                googleCategories.forEach(category => newSet.delete(category.id));
                return newSet;
            });
        } catch (error) {
            console.error('Error deleting Google Calendar events:', error);
        }
    }, [events, categories, state]);

    const handleSaveCustomHoliday = useCallback((holidayData: Partial<CustomHoliday>) => {
        if (!user) return;

        try {
            if (holidayData.id) {
                // Update existing holiday
                (db.transact as any)(
                    (db.tx as any).customHolidays[holidayData.id].update({
                        date: holidayData.date!,
                        note: holidayData.note!,
                    })
                );
                showToast('Holiday updated', 'success');
            } else {
                // Create new holiday
                const newHoliday = {
                    id: uuidv4(),
                    date: holidayData.date!,
                    note: holidayData.note!,
                    userId: user.id,
                    createdAt: Date.now(),
                };
                (db.transact as any)((db.tx as any).customHolidays[newHoliday.id].update(newHoliday));
                showToast('Holiday marked', 'success');
            }
        } catch (error) {
            showToast('Failed to save holiday', 'error');
            console.error('Error saving holiday:', error);
        }
    }, [user, showToast]);

    const handleDeleteCustomHoliday = useCallback((holidayId: string) => {
        try {
            (db.transact as any)((db.tx as any).customHolidays[holidayId].delete());
            showToast('Holiday removed', 'info');
        } catch (error) {
            showToast('Failed to remove holiday', 'error');
            console.error('Error removing holiday:', error);
        }
    }, [showToast]);

    const handleSaveDayNote = useCallback((noteData: Partial<DayNote>) => {
        if (!user) return;

        try {
            if (noteData.id) {
                // Update existing note
                (db.transact as any)(
                    (db.tx as any).dayNotes[noteData.id].update({
                        date: noteData.date!,
                        note: noteData.note!,
                        isHighlighted: !!noteData.isHighlighted,
                        updatedAt: Date.now(),
                    })
                );
                showToast('Note saved', 'success');
            } else {
                // Create new note
                const newNote = {
                    id: uuidv4(),
                    date: noteData.date!,
                    note: noteData.note!,
                    isHighlighted: !!noteData.isHighlighted,
                    userId: user.id,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };
                (db.transact as any)((db.tx as any).dayNotes[newNote.id].update(newNote));
                showToast('Note added', 'success');
            }
        } catch (error) {
            showToast('Failed to save note', 'error');
            console.error('Error saving note:', error);
        }
    }, [user, showToast]);

    const handleDeleteDayNote = useCallback((noteId: string) => {
        try {
            (db.transact as any)((db.tx as any).dayNotes[noteId].delete());
            showToast('Note deleted', 'info');
        } catch (error) {
            showToast('Failed to delete note', 'error');
            console.error('Error deleting note:', error);
        }
    }, [showToast]);

    const handleAddEventFromDayDetail = useCallback(() => {
        state.setIsDayDetailModalOpen(false);
        state.setSelectedEvent(null);
        state.setIsEventModalOpen(true);
    }, [state]);

    return {
        handleSaveEvent,
        handleDeleteEvent,
        handleSaveCategory,
        handleDeleteCategory,
        handleImportGoogleEvents,
        handleEnsureGoogleCalendarCategories,
        handleEnsureGoogleCategoriesFromEvents,
        handleDeduplicateGoogleEvents,
        handleDeleteGoogleEvents,
        handleToggleCategory,
        handleDayClick,
        handleAddEvent,
        handleEditEvent,
        handleAddCategory,
        handleEditCategory,
        handleCloseEventModal,
        handleCloseCategoryModal,
        handleCloseDayDetailModal,
        handleAddEventFromDayDetail,
        handleSaveCustomHoliday,
        handleDeleteCustomHoliday,
        handleSaveDayNote,
        handleDeleteDayNote,
    };
}
