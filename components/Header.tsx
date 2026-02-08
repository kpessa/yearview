'use client';

import { useState } from 'react';
import { Category, Event, db } from '@/lib/instant';
import type { GoogleCalendarListEntry } from '@/lib/googleCalendar';
import { normalizeOpacity, toRgba } from '@/lib/colors';
import GoogleCalendarSync from './GoogleCalendarSync';

interface HeaderProps {
  year: number;
  onYearChange: (year: number) => void;
  categories: Category[];
  visibleCategoryIds: Set<string>;
  onToggleCategory: (categoryId: string) => void;
  onAddCategory: () => void;
  onEditCategory: (category: Category) => void;
  onAddEvent: () => void;
  onOpenDisplayOptions: () => void;
  viewMode: 'year' | 'cards';
  onViewModeChange: (mode: 'year' | 'cards') => void;
  cardViewMode: 'quarter' | 'continuous';
  onCardViewModeChange: (mode: 'quarter' | 'continuous') => void;
  selectedQuarter: 1 | 2 | 3 | 4;
  onQuarterChange: (quarter: 1 | 2 | 3 | 4) => void;
  // Google Calendar Props
  onImportEvents: (events: Partial<Event>[]) => void;
  onDeleteGoogleEvents: () => void;
  onEnsureGoogleCalendarCategories: (calendars: GoogleCalendarListEntry[]) => Map<string, string>;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export default function Header({
  year,
  onYearChange,
  categories,
  visibleCategoryIds,
  onToggleCategory,
  onAddCategory,
  onEditCategory,
  onAddEvent,
  onOpenDisplayOptions,
  viewMode,
  onViewModeChange,
  cardViewMode,
  onCardViewModeChange,
  selectedQuarter,
  onQuarterChange,
  onImportEvents,
  onDeleteGoogleEvents,
  onEnsureGoogleCalendarCategories,
  onToggleSidebar,
  isSidebarOpen,
}: HeaderProps) {
  const { user } = db.useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);

  const handleSignOut = () => {
    db.auth.signOut();
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear + i);
  const suitOptions = [
    { value: 1, label: '♠ Spades (Q1)' },
    { value: 2, label: '♥ Hearts (Q2)' },
    { value: 3, label: '♣ Clubs (Q3)' },
    { value: 4, label: '♦ Diamonds (Q4)' },
  ] as const;

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-neutral-300">
      <div className="max-w-[1800px] mx-auto px-4 py-3">
        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onToggleSidebar}
              className="p-2 hover:bg-neutral-100 rounded-xl transition-colors text-neutral-600"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-neutral-700 to-neutral-800 rounded-2xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-normal tracking-tight text-neutral-900">
                YearView
              </h1>
            </div>

            <select
              value={year}
              onChange={(e) => onYearChange(Number(e.target.value))}
              className="px-4 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 font-normal hover:border-neutral-400 focus:ring-2 focus:ring-neutral-400 focus:border-transparent outline-none transition-all cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <div className="flex items-center bg-neutral-100 rounded-xl p-1">
              <button
                onClick={() => onViewModeChange('year')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'year' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'
                  }`}
              >
                Year
              </button>
              <button
                onClick={() => onViewModeChange('cards')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'cards' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'
                  }`}
              >
                Cards
              </button>
            </div>

            {viewMode === 'cards' && (
              <div className="flex bg-neutral-100 rounded-xl p-1 ml-2">
                <button
                  onClick={() => onCardViewModeChange('quarter')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${cardViewMode === 'quarter' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'
                    }`}
                >
                  Quarter
                </button>
                <button
                  onClick={() => onCardViewModeChange('continuous')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${cardViewMode === 'continuous' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'
                    }`}
                >
                  Continuous
                </button>
              </div>
            )}

            {viewMode === 'cards' && cardViewMode === 'quarter' && (
              <select
                value={selectedQuarter}
                onChange={(e) => onQuarterChange(Number(e.target.value) as 1 | 2 | 3 | 4)}
                className="px-3 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 font-normal hover:border-neutral-400 focus:ring-2 focus:ring-neutral-400 focus:border-transparent outline-none transition-all cursor-pointer ml-2"
              >
                {suitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onAddEvent}
              className="px-4 py-2 bg-neutral-900 text-white rounded-xl font-medium hover:bg-neutral-800 transition-all flex items-center space-x-2 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Event</span>
            </button>

            <div className="flex items-center space-x-2 text-sm text-neutral-700">
              <span>{user?.email}</span>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-neutral-700 to-neutral-800 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <select
                value={year}
                onChange={(e) => onYearChange(Number(e.target.value))}
                className="px-2 py-1 rounded-lg border border-neutral-300 bg-white text-neutral-900 text-sm"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={onAddEvent}
                className="p-2 bg-neutral-900 text-white rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-neutral-700 hover:bg-neutral-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="py-3 border-t border-neutral-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center bg-neutral-100 rounded-xl p-1">
                  <button
                    onClick={() => onViewModeChange('year')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'year' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'
                      }`}
                  >
                    Year
                  </button>
                  <button
                    onClick={() => onViewModeChange('cards')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'cards' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'
                      }`}
                  >
                    Cards
                  </button>
                </div>
                {viewMode === 'cards' && (
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex bg-neutral-100 rounded-lg p-1 ml-2">
                      <button
                        onClick={() => onCardViewModeChange('quarter')}
                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${cardViewMode === 'quarter' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'}`}
                      >
                        Qtr
                      </button>
                      <button
                        onClick={() => onCardViewModeChange('continuous')}
                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${cardViewMode === 'continuous' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'}`}
                      >
                        Cont
                      </button>
                    </div>
                    {cardViewMode === 'quarter' && (
                      <select
                        value={selectedQuarter}
                        onChange={(e) => onQuarterChange(Number(e.target.value) as 1 | 2 | 3 | 4)}
                        className="px-2 py-1 rounded-lg border border-neutral-300 bg-white text-neutral-900 text-xs"
                      >
                        {suitOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600 truncate max-w-[200px]">{user?.email}</span>
                <button
                  onClick={handleSignOut}
                  className="text-red-600 hover:text-red-700"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Categories Section - Both Desktop and Mobile */}
        {/* Categories Section moved to Sidebar */}

        {/* Mobile Categories Dropdown */}
        <div className="md:hidden">
          <button
            onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
            className="w-full flex items-center justify-between py-2 text-sm font-medium text-neutral-700"
          >
            <span>Categories ({categories.length})</span>
            <svg
              className={`w-4 h-4 transition-transform ${isCategoriesOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isCategoriesOpen && (
            <div className="py-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => {
                  const isVisible = visibleCategoryIds.has(category.id);
                  const categoryOpacity = normalizeOpacity(category.opacity);
                  const pillBackgroundOpacity = isVisible ? 0.25 * categoryOpacity : 0.12 * categoryOpacity;
                  const pillBorderOpacity = isVisible ? Math.min(1, 0.9 * categoryOpacity + 0.1) : 0;
                  const pillTextOpacity = isVisible ? 1 : 0.7;
                  return (
                    <button
                      key={category.id}
                      onClick={() => onToggleCategory(category.id)}
                      onDoubleClick={() => onEditCategory(category)}
                      className={`
                        px-3 py-1.5 rounded-full font-medium text-xs transition-all
                        ${isVisible ? 'opacity-100' : 'opacity-40'}
                      `}
                      style={{
                        backgroundColor: toRgba(category.color, pillBackgroundOpacity),
                        color: toRgba(category.color, pillTextOpacity),
                        border: `2px solid ${isVisible ? toRgba(category.color, pillBorderOpacity) : 'transparent'}`,
                      }}
                    >
                      <span className="flex items-center space-x-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: toRgba(category.color, categoryOpacity) }}
                        ></span>
                        <span>{category.name}</span>
                      </span>
                    </button>
                  );
                })}
                <button
                  onClick={onAddCategory}
                  className="px-3 py-1.5 border-2 border-dashed border-neutral-400 text-neutral-700 rounded-full font-medium text-xs"
                >
                  + Add
                </button>
              </div>
              <button
                onClick={() => {
                  const today = new Date();
                  onYearChange(today.getFullYear());
                  setTimeout(() => {
                    const todayElement = document.querySelector('[class*="bg-green-50"]');
                    todayElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 100);
                }}
                className="w-full py-2 bg-neutral-100 text-neutral-800 rounded-lg text-sm font-medium"
              >
                Go to Today
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
