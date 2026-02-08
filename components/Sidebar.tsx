'use client';

import { Category, Event, db } from '@/lib/instant';
import type { GoogleCalendarListEntry } from '@/lib/googleCalendar';
import { normalizeOpacity, toRgba } from '@/lib/colors';
import GoogleCalendarSync from './GoogleCalendarSync';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    year: number;
    onYearChange: (year: number) => void;
    categories: Category[];
    visibleCategoryIds: Set<string>;
    onToggleCategory: (categoryId: string) => void;
    onAddCategory: () => void;
    onEditCategory: (category: Category) => void;
    onOpenDisplayOptions: () => void;
    onImportEvents: (events: Partial<Event>[]) => void;
    onDeleteGoogleEvents: () => void;
    onEnsureGoogleCalendarCategories: (calendars: GoogleCalendarListEntry[]) => Map<string, string>;
}

export default function Sidebar({
    isOpen,
    onClose,
    year,
    onYearChange,
    categories,
    visibleCategoryIds,
    onToggleCategory,
    onAddCategory,
    onEditCategory,
    onOpenDisplayOptions,
    onImportEvents,
    onDeleteGoogleEvents,
    onEnsureGoogleCalendarCategories,
}: SidebarProps) {
    const { user } = db.useAuth();
    const currentYear = new Date().getFullYear();

    return (
        <>
            {/* Backdrop for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-40 md:hidden"
                    onClick={onClose}
                ></div>
            )}

            <aside
                className={`fixed top-[0px] left-0 h-[calc(100vh)] bg-white border-r border-neutral-200 z-40 w-80 transform transition-transform duration-300 ease-in-out overflow-y-auto ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    } pt-20 pb-6 shadow-lg`}
            >
                <div className="px-4 space-y-6">

                    {/* Quick Actions */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Quick Actions</h3>
                        <button
                            onClick={() => {
                                const today = new Date();
                                onYearChange(today.getFullYear());
                                setTimeout(() => {
                                    const todayElement = document.querySelector('[class*="bg-green-50"]');
                                    todayElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }, 100);
                                if (window.innerWidth < 768) onClose();
                            }}
                            className="w-full px-4 py-2 bg-neutral-100 text-neutral-800 rounded-xl font-medium hover:bg-neutral-200 transition-all text-sm flex items-center justify-center gap-2"
                        >
                            <span>Go to Today ({currentYear})</span>
                        </button>
                    </div>


                    {/* Categories */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Categories</h3>
                            <button
                                onClick={onAddCategory}
                                className="p-1 hover:bg-neutral-100 rounded text-neutral-600"
                                title="Add Category"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            {categories.map((category) => {
                                const isVisible = visibleCategoryIds.has(category.id);
                                const categoryOpacity = normalizeOpacity(category.opacity);
                                const pillBackgroundOpacity = isVisible ? 0.25 * categoryOpacity : 0.12 * categoryOpacity;
                                const pillBorderOpacity = isVisible ? Math.min(1, 0.9 * categoryOpacity + 0.1) : 0;
                                const pillTextOpacity = isVisible ? 1 : 0.7;
                                return (
                                    <div key={category.id} className="relative group flex items-center">
                                        <button
                                            onClick={() => onToggleCategory(category.id)}
                                            onDoubleClick={() => onEditCategory(category)}
                                            className={`
                            w-full px-3 py-2 rounded-lg font-medium text-sm transition-all text-left flex items-center gap-3
                            ${isVisible ? 'opacity-100' : 'opacity-50'}
                            `}
                                            style={{
                                                backgroundColor: toRgba(category.color, pillBackgroundOpacity),
                                                color: toRgba(category.color, pillTextOpacity),
                                                border: `1px solid ${isVisible ? toRgba(category.color, pillBorderOpacity) : 'transparent'}`,
                                            }}
                                        >
                                            <span
                                                className="w-3 h-3 rounded-full shrink-0"
                                                style={{ backgroundColor: toRgba(category.color, categoryOpacity) }}
                                            ></span>
                                            <span className="truncate">{category.name}</span>
                                        </button>
                                        <button
                                            className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-black/10 rounded transition-opacity"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEditCategory(category);
                                            }}
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                    </div>
                                );
                            })}
                            {categories.length === 0 && (
                                <div className="text-sm text-neutral-400 italic px-2">No categories yet</div>
                            )}
                        </div>
                    </div>

                    {/* Sync & Settings */}
                    <div className="space-y-3 pt-4 border-t border-neutral-100">
                        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Settings</h3>

                        <div className="bg-white rounded-xl border border-neutral-200 p-3 shadow-sm">
                            <GoogleCalendarSync
                                year={year}
                                onImportEvents={onImportEvents}
                                onDeleteGoogleEvents={onDeleteGoogleEvents}
                                onEnsureGoogleCalendarCategories={onEnsureGoogleCalendarCategories}
                                userEmail={user?.email || undefined}
                                isSidebar={true}
                            />
                        </div>

                        <button
                            onClick={onOpenDisplayOptions}
                            className="w-full flex items-center justify-between px-4 py-3 bg-white border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 rounded-xl transition-all text-sm text-neutral-700 font-medium group"
                        >
                            <span className="flex items-center gap-3">
                                <svg className="w-5 h-5 text-neutral-400 group-hover:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Display Options
                            </span>
                            <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
