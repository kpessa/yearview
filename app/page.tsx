'use client';

import { useEffect } from 'react';
import AuthWrapper from '@/components/AuthWrapper';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import YearGrid from '@/components/YearGrid';
import CardWeekGrid from '@/components/CardWeekGrid';
import EventModal from '@/components/EventModal';
import CategoryModal from '@/components/CategoryModal';
import DayDetailModal from '@/components/DayDetailModal';
import DisplayOptionsModal from '@/components/DisplayOptionsModal';
import { CalendarSkeleton } from '@/components/Skeleton';
import { ToastProvider } from '@/contexts/ToastContext';
import {
  useCalendarState,
  useCalendarData,
  useVisibleCategoriesInit,
  useSelectedDateEvents
} from '@/hooks/useCalendarState';
import { useCalendarActions } from '@/hooks/useCalendarActions';

function CalendarApp() {
  const state = useCalendarState();
  const { categories, events, customHolidays, dayNotes, isLoading } = useCalendarData(state.selectedYear);


  // Initialize hooks
  useVisibleCategoriesInit(categories, state.visibleCategoryIds, state.setVisibleCategoryIds);
  const selectedDateEvents = useSelectedDateEvents(state.selectedDate, events);
  const actions = useCalendarActions(state, categories, events);
  const { handleEnsureGoogleCategoriesFromEvents, handleDeduplicateGoogleEvents } = actions;

  useEffect(() => {
    handleEnsureGoogleCategoriesFromEvents();
    handleDeduplicateGoogleEvents();
  }, [handleEnsureGoogleCategoriesFromEvents, handleDeduplicateGoogleEvents, events, categories]);

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <Header
        year={state.selectedYear}
        onYearChange={state.setSelectedYear}
        categories={categories}
        visibleCategoryIds={state.visibleCategoryIds}
        onToggleCategory={actions.handleToggleCategory}
        onAddCategory={actions.handleAddCategory}
        onEditCategory={actions.handleEditCategory}
        onAddEvent={actions.handleAddEvent}
        onOpenDisplayOptions={() => state.setIsDisplayOptionsOpen(true)}
        viewMode={state.viewMode}
        onViewModeChange={state.setViewMode}
        selectedQuarter={state.selectedQuarter}
        onQuarterChange={state.setSelectedQuarter}
        cardViewMode={state.cardViewMode}
        onCardViewModeChange={state.setCardViewMode}

        // Google Calendar Props
        onImportEvents={actions.handleImportGoogleEvents}
        onDeleteGoogleEvents={actions.handleDeleteGoogleEvents}
        onEnsureGoogleCalendarCategories={actions.handleEnsureGoogleCalendarCategories}
        onToggleSidebar={() => state.setIsSidebarOpen(!state.isSidebarOpen)}
        isSidebarOpen={state.isSidebarOpen}
      />

      <Sidebar
        isOpen={state.isSidebarOpen}
        onClose={() => state.setIsSidebarOpen(false)}
        year={state.selectedYear}
        onYearChange={state.setSelectedYear}
        categories={categories}
        visibleCategoryIds={state.visibleCategoryIds}
        onToggleCategory={actions.handleToggleCategory}
        onAddCategory={actions.handleAddCategory}
        onEditCategory={actions.handleEditCategory}
        onOpenDisplayOptions={() => state.setIsDisplayOptionsOpen(true)}
        onImportEvents={actions.handleImportGoogleEvents}
        onDeleteGoogleEvents={actions.handleDeleteGoogleEvents}
        onEnsureGoogleCalendarCategories={actions.handleEnsureGoogleCalendarCategories}
      />

      <div className={`transition-all duration-300 ${state.isSidebarOpen ? 'ml-0 md:ml-80' : 'ml-0'}`}>

        <div className="max-w-[1800px] mx-auto px-2 py-4">
        </div>

        <main className="max-w-[1800px] mx-auto px-2 py-2">
          {isLoading ? (
            <CalendarSkeleton />
          ) : (
            state.viewMode === 'cards' ? (
              <CardWeekGrid
                year={state.selectedYear}
                events={events}
                categories={categories}
                visibleCategoryIds={state.visibleCategoryIds}
                customHolidays={customHolidays}
                dayNotes={dayNotes}
                onDayClick={actions.handleDayClick}
                onEventClick={actions.handleEditEvent}
                showUSHolidays={state.showUSHolidays}
                showIndiaHolidays={state.showIndiaHolidays}
                showLongWeekends={state.showLongWeekends}
                showPastDatesAsGray={state.showPastDatesAsGray}
                quarter={state.selectedQuarter}
                cardViewMode={state.cardViewMode}
              />
            ) : (
              <YearGrid
                year={state.selectedYear}
                events={events}
                categories={categories}
                visibleCategoryIds={state.visibleCategoryIds}
                customHolidays={customHolidays}
                dayNotes={dayNotes}
                onDayClick={actions.handleDayClick}
                onEventClick={actions.handleEditEvent}
                showUSHolidays={state.showUSHolidays}
                showIndiaHolidays={state.showIndiaHolidays}
                showLongWeekends={state.showLongWeekends}
                showPastDatesAsGray={state.showPastDatesAsGray}
              />
            )
          )}
        </main>
      </div>

      <EventModal
        isOpen={state.isEventModalOpen}
        onClose={actions.handleCloseEventModal}
        onSave={actions.handleSaveEvent}
        onDelete={actions.handleDeleteEvent}
        event={state.selectedEvent}
        categories={categories}
        selectedDate={state.selectedDate}
      />

      <CategoryModal
        isOpen={state.isCategoryModalOpen}
        onClose={actions.handleCloseCategoryModal}
        onSave={actions.handleSaveCategory}
        onDelete={actions.handleDeleteCategory}
        category={state.selectedCategory}
      />

      <DayDetailModal
        isOpen={state.isDayDetailModalOpen}
        onClose={actions.handleCloseDayDetailModal}
        date={state.selectedDate}
        events={selectedDateEvents}
        categories={categories}
        customHolidays={customHolidays}
        dayNotes={dayNotes}
        onEditEvent={actions.handleEditEvent}
        onAddEvent={actions.handleAddEventFromDayDetail}
        onSaveHoliday={actions.handleSaveCustomHoliday}
        onDeleteHoliday={actions.handleDeleteCustomHoliday}
        onSaveDayNote={actions.handleSaveDayNote}
        onDeleteDayNote={actions.handleDeleteDayNote}
      />

      <DisplayOptionsModal
        isOpen={state.isDisplayOptionsOpen}
        onClose={() => state.setIsDisplayOptionsOpen(false)}
        showPastDatesAsGray={state.showPastDatesAsGray}
        setShowPastDatesAsGray={state.setShowPastDatesAsGray}
        showUSHolidays={state.showUSHolidays}
        setShowUSHolidays={state.setShowUSHolidays}
        showIndiaHolidays={state.showIndiaHolidays}
        setShowIndiaHolidays={state.setShowIndiaHolidays}
        showLongWeekends={state.showLongWeekends}
        setShowLongWeekends={state.setShowLongWeekends}
      />
    </div>
  );
}

export default function Home() {
  return (
    <AuthWrapper>
      <ToastProvider>
        <CalendarApp />
      </ToastProvider>
    </AuthWrapper>
  );
}
