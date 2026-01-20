'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, MapPin, Star, Filter } from 'lucide-react';
import type { Cafe, Coordinate } from '@/types/cafe';
import { FilterModal } from '@/components/ui/FilterModal';
import { useAppStore } from '@/lib/store/AppStore';

type CafeSidebarProps = {
    isCollapsed: boolean;
    onToggle: (collapsed: boolean) => void;
    cafes: Cafe[];
    isSearching: boolean;
    searchError: string | null;
    searchQuery: string;
    onSearchQueryChange: (value: string) => void;
    onSearchSubmit: (e: React.FormEvent) => void;
    onSearchClick: (e: React.MouseEvent) => void;
    onClearSearch: () => void;
    isShowingSearchResults: boolean;
    onSearchAround: (e: React.MouseEvent) => void;
    userLocation: Coordinate | null;
    selectedCafeId: string | null;
    onCafeClick: (cafe: Cafe) => void;
    cafeItemRefs: React.MutableRefObject<{ [key: string]: HTMLDivElement | null }>;
    panelRef: React.RefObject<HTMLDivElement | null>;
    formatDistance: (distanceMeters?: number) => string;
};

export function CafeSidebar({
    isCollapsed,
    onToggle,
    cafes,
    isSearching,
    searchError,
    searchQuery,
    onSearchQueryChange,
    onSearchSubmit,
    onSearchClick,
    onClearSearch,
    isShowingSearchResults,
    onSearchAround,
    userLocation,
    selectedCafeId,
    onCafeClick,
    cafeItemRefs,
    panelRef,
    formatDistance,
}: CafeSidebarProps) {
    const [showFilterModal, setShowFilterModal] = useState(false);
    const { state, setSearchFilters, onSearch } = useAppStore();
    const { searchFilters, activeSearchQuery } = state;

    // Check if any filters are active (not default values)
    const hasActiveFilters =
        searchFilters.maxDistance !== 10 ||
        searchFilters.minOverallRating > 0 ||
        searchFilters.minWifiRating > 0 ||
        searchFilters.minOutletsRating > 0 ||
        searchFilters.minCoffeeRating > 0 ||
        searchFilters.minVibeRating > 0 ||
        searchFilters.minSeatingRating > 0 ||
        searchFilters.minNoiseRating > 0 ||
        searchFilters.minReviews > 0 ||
        searchFilters.sortBy !== 'relevance' ||
        searchFilters.hasWifi !== null ||
        searchFilters.hasOutlets !== null ||
        searchFilters.goodForWork !== null ||
        searchFilters.quietWorkspace !== null ||
        searchFilters.spacious !== null ||
        searchFilters.maxPriceLevel > 0;
    return (
        <div className="absolute left-4 md:left-6 top-24 md:top-28 z-50 flex items-start gap-2">
            {/* Sidebar Panel */}
            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        key="sidebar-panel"
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 384, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                            opacity: { duration: 0.2 }
                        }}
                        className="bg-c2c-base/95 border-2 border-c2c-orange rounded-3xl shadow-2xl overflow-hidden max-h-[78vh] flex flex-col"
                    >

                        {/* Search Bar in Panel */}
                        <motion.div
                            className="p-4 border-b-2 border-c2c-orange"
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.3 }}
                        >
                            {/* Location Status Indicator */}
                            <AnimatePresence>
                                {!userLocation && !searchError && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mb-3 bg-blue-50 text-blue-700 px-3 py-2 rounded text-xs border border-blue-300 flex items-center gap-2 overflow-hidden"
                                    >
                                        <div className="animate-spin h-3 w-3 border-2 border-blue-700 border-t-transparent rounded-full"></div>
                                        <span>Getting your location...</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <form onSubmit={onSearchSubmit} className="mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-row items-center border border-c2c-orange rounded-lg px-2 flex-1">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-4 w-4 text-c2c-orange pointer-events-none"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => onSearchQueryChange(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    onSearchSubmit(e as unknown as React.FormEvent);
                                                }
                                            }}
                                            placeholder="Search cafes..."
                                            className="w-full px-3 py-2 bg-c2c-base focus:outline-none focus:border-none focus:ring-0 text-sm placeholder-c2c-orange text-c2c-orange"
                                            disabled={!userLocation || isSearching}
                                        />

                                        {/* Clear button - only show when there's a search query or showing search results */}
                                        <AnimatePresence>
                                            {(searchQuery || isShowingSearchResults) && (
                                                <motion.button
                                                    type="button"
                                                    onClick={onClearSearch}
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.8 }}
                                                    className="text-c2c-orange hover:text-c2c-orange-dark transition-colors"
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.9 }}
                                                >
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="h-4 w-4"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </motion.button>
                                            )}
                                        </AnimatePresence>

                                    </div>
                                    <motion.button
                                        type="submit"
                                        onClick={onSearchClick}
                                        disabled={!userLocation || isSearching || !searchQuery.trim()}
                                        className="bg-c2c-orange hover:bg-c2c-orange-dark disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 400,
                                            damping: 20
                                        }}
                                    >
                                        Search
                                    </motion.button>
                                </div>
                            </form>

                            {/* Search Around Me Button */}
                            <div className="flex gap-2">
                                <motion.button
                                    onClick={onSearchAround}
                                    disabled={!userLocation || isSearching}
                                    className="bg-c2c-base hover:bg-c2c-base disabled:opacity-50 disabled:cursor-not-allowed border border-c2c-orange text-c2c-orange px-4 py-2 rounded text-sm font-medium flex items-center gap-2 flex-1"
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 400,
                                        damping: 20
                                    }}
                                >
                                    <AnimatePresence mode="wait">
                                        {isSearching ? (
                                            <motion.div
                                                key="searching"
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                className="flex items-center gap-2"
                                            >
                                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                <span className="text-sm">Searching...</span>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="nearby"
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                className="flex items-center gap-2"
                                            >
                                                <MapPin className="h-4 w-4" />
                                                <span className="text-sm">Nearby (2mi)</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.button>

                                {/* Results count - always visible */}
                                <div className="bg-c2c-orange text-white px-3 py-2 rounded text-sm font-medium">
                                    {cafes.length}
                                </div>

                                {/* Filter button - always visible */}
                                <button
                                    type="button"
                                    onClick={() => setShowFilterModal(true)}
                                    className={`relative p-2 rounded transition-all ${hasActiveFilters
                                            ? 'bg-c2c-orange text-white'
                                            : 'bg-c2c-base border border-c2c-orange text-c2c-orange hover:bg-c2c-orange hover:text-white'
                                        }`}
                                    title={hasActiveFilters ? "Filters active - Click to adjust" : "Filter results"}
                                >
                                    <Filter className="h-4 w-4" />
                                    {/* Visual indicator when filters are active - pulsing dot */}
                                    {hasActiveFilters && (
                                        <motion.span
                                            className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-full border-2 border-c2c-orange-dark"
                                            animate={{
                                                scale: [1, 1.2, 1],
                                                opacity: [1, 0.7, 1]
                                            }}
                                            transition={{
                                                duration: 2,
                                                repeat: Infinity,
                                                ease: "easeInOut"
                                            }}
                                        />
                                    )}
                                </button>
                            </div>

                            {/* Error message */}
                            <AnimatePresence>
                                {searchError && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, y: -10 }}
                                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                                        exit={{ opacity: 0, height: 0, y: -10 }}
                                        transition={{ duration: 0.3 }}
                                        className="mt-2 bg-red-100 text-red-800 px-3 py-2 rounded text-sm border border-red-300 overflow-hidden"
                                    >
                                        {searchError}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>

                        {/* Cafe List Panel */}
                        <AnimatePresence mode="wait">
                            {cafes.length > 0 ? (
                                <motion.div
                                    key="cafe-list"
                                    ref={panelRef}
                                    className="flex-1 overflow-y-auto"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <div className="p-4 space-y-3">
                                        {cafes.map((cafe, index) => (
                                            <motion.div
                                                key={cafe.id}
                                                ref={(el) => {
                                                    cafeItemRefs.current[cafe.id] = el;
                                                }}
                                                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                                                transition={{
                                                    delay: index * 0.05,
                                                    type: "spring",
                                                    stiffness: 300,
                                                    damping: 25
                                                }}
                                                onClick={() => onCafeClick(cafe)}
                                                whileHover={{
                                                    scale: 1.02,
                                                    transition: { duration: 0.2 }
                                                }}
                                                whileTap={{ scale: 0.98 }}
                                                className={`p-3 cursor-pointer rounded border-2 ${selectedCafeId === cafe.id
                                                    ? 'border-c2c-orange bg-c2c-base'
                                                    : 'border-c2c-orange/40 bg-white hover:bg-c2c-base'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        {/* Cafe name and ranking */}
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs text-c2c-orange font-semibold w-6">
                                                                #{index + 1}
                                                            </span>
                                                            <h3 className="text-sm font-semibold text-c2c-orange truncate">
                                                                {cafe.name}
                                                            </h3>
                                                        </div>

                                                        {/* Distance */}
                                                        <div className="flex items-center gap-1 text-xs text-c2c-orange mb-2">
                                                            <MapPin size={12} className="text-c2c-orange" />
                                                            <span>{formatDistance(cafe.distance)}</span>
                                                        </div>

                                                        {/* Address */}
                                                        {cafe.address && (
                                                            <p className="text-xs text-c2c-orange mb-2 line-clamp-1">
                                                                {cafe.address}
                                                            </p>
                                                        )}

                                                        {/* Overall Rating */}
                                                        <div className="flex items-center gap-1 mb-2">
                                                            <Star size={12} className="text-c2c-orange fill-c2c-orange" />
                                                            <span className="text-xs font-semibold text-c2c-orange">
                                                                {cafe.ratings.overall > 0 ? cafe.ratings.overall.toFixed(1) : '0.0'}
                                                            </span>
                                                            {cafe.totalReviews > 0 && (
                                                                <span className="text-xs text-c2c-orange">
                                                                    ({cafe.totalReviews} {cafe.totalReviews === 1 ? 'review' : 'reviews'})
                                                                </span>
                                                            )}
                                                        </div>

                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="no-cafes"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ delay: 0.2 }}
                                    className="flex-1 flex items-center justify-center p-8"
                                >
                                    <div className="text-center text-c2c-orange">
                                        <p className="text-sm font-semibold mb-1">No cafes found</p>
                                        <p className="text-xs">Search to see results</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Collapse/Expand Button - Always visible, fixed position */}
            <motion.button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggle(!isCollapsed);
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 25
                }}
                className="bg-c2c-base/95 border-2 border-c2c-orange p-3 rounded-full shadow-xl hover:bg-c2c-base shrink-0"
                aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
            >
                <motion.div
                    animate={{ rotate: isCollapsed ? 0 : 180 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                    <ChevronRight size={18} className="text-c2c-orange" />
                </motion.div>
            </motion.button>

            {/* Filter Modal */}
            <FilterModal
                isOpen={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                filters={searchFilters}
                onFiltersChange={setSearchFilters}
                onApply={() => {
                    // Filters are in query keys, so queries will auto-refetch
                    // No need to manually trigger - React Query handles it
                }}
            />
        </div>
    );
}

