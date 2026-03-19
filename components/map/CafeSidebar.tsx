'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, MapPin, Star, Filter } from 'lucide-react';
import type { Cafe, Coordinate, AddressSuggestion } from '@/types/cafe';
import { FilterModal } from '@/components/ui/FilterModal';
import { SearchDropdown } from '@/components/map/SearchDropdown';
import { useAppStore } from '@/lib/store/AppStore';
import { useIsMobile, useIsTablet } from '@/hooks/useIsMobile';
import { BottomSheet } from '@/components/map/BottomSheet';

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
    isRatingPanelOpen?: boolean; // hides mobile bottom sheet when rating panel is open
    onSelectAddress: (address: AddressSuggestion) => void;
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
    isRatingPanelOpen = false,
    onSelectAddress,
}: CafeSidebarProps) {
    const [showFilterModal, setShowFilterModal] = useState(false);
    const { state, setSearchFilters, onSearch } = useAppStore();
    const { searchFilters, activeSearchQuery } = state;
    const isMobile = useIsMobile();
    const isTablet = useIsTablet();

    // Autocomplete state
    const [autocafes, setAutocafes] = useState<Cafe[]>([]);
    const [autoAddresses, setAutoAddresses] = useState<AddressSuggestion[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isAutoSearching, setIsAutoSearching] = useState(false);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const searchWrapperRef = useRef<HTMLDivElement>(null);

    // Debounced autocomplete search
    const runAutocomplete = useCallback(
        (query: string) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (abortRef.current) abortRef.current.abort();

            if (query.trim().length < 2 || !userLocation) {
                setAutocafes([]);
                setAutoAddresses([]);
                setShowDropdown(false);
                return;
            }

            debounceRef.current = setTimeout(async () => {
                const controller = new AbortController();
                abortRef.current = controller;
                setIsAutoSearching(true);

                try {
                    // Always search cafes in DB first
                    const cafeRes = await fetch(
                        `/api/cafes/search?q=${encodeURIComponent(query)}&lat=${userLocation.lat}&lng=${userLocation.lng}&sortBy=relevance`,
                        { signal: controller.signal }
                    );

                    if (!cafeRes.ok) throw new Error('cafe search failed');
                    const cafeData = await cafeRes.json();
                    const cafeHits: Cafe[] = (cafeData.cafes || []).slice(0, 5);

                    if (controller.signal.aborted) return;
                    setAutocafes(cafeHits);

                    // If < 3 cafe results, also geocode for addresses
                    if (cafeHits.length < 3) {
                        const geoRes = await fetch(
                            `/api/geocode?q=${encodeURIComponent(query)}&lat=${userLocation.lat}&lng=${userLocation.lng}`,
                            { signal: controller.signal }
                        );
                        if (geoRes.ok) {
                            const geoData = await geoRes.json();
                            if (!controller.signal.aborted) {
                                setAutoAddresses(geoData.suggestions || []);
                            }
                        }
                    } else {
                        setAutoAddresses([]);
                    }

                    if (!controller.signal.aborted) {
                        setShowDropdown(true);
                    }
                } catch (err: unknown) {
                    if (err instanceof DOMException && err.name === 'AbortError') return;
                    // Silently fail — user can still submit manually
                } finally {
                    if (!controller.signal.aborted) {
                        setIsAutoSearching(false);
                    }
                }
            }, 100);
        },
        [userLocation]
    );

    // Run autocomplete when search query changes
    useEffect(() => {
        runAutocomplete(searchQuery);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [searchQuery, runAutocomplete]);

    // Close dropdown when active search is set (user pressed Enter)
    useEffect(() => {
        if (activeSearchQuery) {
            setShowDropdown(false);
        }
    }, [activeSearchQuery]);

    const handleSelectCafe = (cafe: Cafe) => {
        setShowDropdown(false);
        onCafeClick(cafe);
    };

    const handleSelectAddress = (address: AddressSuggestion) => {
        setShowDropdown(false);
        onSelectAddress(address);
    };

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

    // Shared inner content: search bar + cafe list
    const sidebarContent = (
        <>
            {/* Search Bar */}
            <div className="p-4 border-b-2 border-c2c-orange shrink-0">
                {/* Location Status Indicator */}
                <AnimatePresence>
                    {!userLocation && !searchError && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-3 bg-gray-50 text-gray-700 px-3 py-2 rounded text-xs border border-gray-300 flex items-center gap-2 overflow-hidden"
                        >
                            <div className="animate-spin h-3 w-3 border-2 border-gray-700 border-t-transparent rounded-full"></div>
                            <span>Getting your location...</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={onSearchSubmit} className="mb-3">
                    <div className="flex items-center gap-2">
                        <div ref={searchWrapperRef} className="flex flex-row items-center border border-c2c-orange rounded-lg px-2 flex-1 relative">
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
                                placeholder="Search cafes or an address..."
                                className="w-full px-3 py-2 bg-transparent focus:outline-none focus:border-none focus:ring-0 text-sm placeholder-c2c-orange text-c2c-orange"
                                disabled={!userLocation || isSearching}
                            />

                            {/* Clear button */}
                            <AnimatePresence>
                                {(searchQuery || isShowingSearchResults) && (
                                    <motion.button
                                        type="button"
                                        onClick={onClearSearch}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        className="text-c2c-orange hover:text-c2c-orange-dark transition-all min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center hover:scale-110 active:scale-90"
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

                            {/* Autocomplete dropdown */}
                            {showDropdown && (autocafes.length > 0 || autoAddresses.length > 0 || isAutoSearching) && (
                                <SearchDropdown
                                    cafeResults={autocafes}
                                    addressResults={autoAddresses}
                                    isLoading={isAutoSearching}
                                    onSelectCafe={handleSelectCafe}
                                    onSelectAddress={handleSelectAddress}
                                    onClose={() => setShowDropdown(false)}
                                />
                            )}

                        </div>
                        <button
                            type="submit"
                            onClick={onSearchClick}
                            disabled={!userLocation || isSearching || !searchQuery.trim()}
                            className="bg-c2c-orange hover:bg-c2c-orange-dark disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center min-h-[44px] transition-transform duration-150 hover:scale-105 active:scale-95"
                        >
                            Search
                        </button>
                    </div>
                </form>

                {/* Search Around Me Button */}
                <div className="flex gap-2">
                    <button
                        onClick={onSearchAround}
                        disabled={!userLocation || isSearching}
                        className="bg-c2c-base hover:bg-c2c-base disabled:opacity-50 disabled:cursor-not-allowed border border-c2c-orange text-c2c-orange px-4 py-2 rounded text-sm font-medium flex items-center gap-2 flex-1 min-h-[44px] transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
                    >
                        {isSearching ? (
                            <div className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="text-sm">Searching...</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                <span className="text-sm">Nearby (2mi)</span>
                            </div>
                        )}
                    </button>

                    {/* Results count */}
                    <div className="bg-c2c-orange text-white px-3 py-2 rounded text-sm font-medium flex items-center">
                        {cafes.length}
                    </div>

                    {/* Filter button */}
                    <button
                        type="button"
                        onClick={() => setShowFilterModal(true)}
                        className={`relative p-2 rounded transition-all min-w-[44px] min-h-[44px] flex items-center justify-center ${hasActiveFilters
                                ? 'bg-c2c-orange text-white'
                                : 'bg-c2c-base border border-c2c-orange text-c2c-orange hover:bg-c2c-orange hover:text-white'
                            }`}
                        title={hasActiveFilters ? "Filters active - Click to adjust" : "Filter results"}
                    >
                        <Filter className="h-4 w-4" />
                        {hasActiveFilters && (
                            <span
                                className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-full border-2 border-c2c-orange-dark animate-pulse"
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
            </div>

            {/* Cafe List */}
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
                                <div
                                    key={cafe.id}
                                    ref={(el) => {
                                        cafeItemRefs.current[cafe.id] = el;
                                    }}
                                    onClick={() => onCafeClick(cafe)}
                                    className={`p-3 min-h-[44px] cursor-pointer rounded border-2 transition-colors duration-150 hover:scale-[1.02] active:scale-[0.98] transform ${selectedCafeId === cafe.id
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
                                </div>
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
        </>
    );

    // Mobile: render inside bottom sheet (hidden when rating panel is open to avoid overlap)
    if (isMobile) {
        if (isRatingPanelOpen) {
            return (
                <FilterModal
                    isOpen={showFilterModal}
                    onClose={() => setShowFilterModal(false)}
                    filters={searchFilters}
                    onFiltersChange={setSearchFilters}
                    onApply={() => {}}
                />
            );
        }

        return (
            <>
                <BottomSheet snapPoints={[25, 50, 90]} defaultSnap={0}>
                    {sidebarContent}
                </BottomSheet>

                <FilterModal
                    isOpen={showFilterModal}
                    onClose={() => setShowFilterModal(false)}
                    filters={searchFilters}
                    onFiltersChange={setSearchFilters}
                    onApply={() => {}}
                />
            </>
        );
    }

    // Desktop/Tablet: render as left sidebar panel
    return (
        <div className="absolute left-4 md:left-6 top-20 z-50 flex items-start gap-2">
            {/* Sidebar Panel */}
            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        key="sidebar-panel"
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: isTablet ? 320 : 384, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                            opacity: { duration: 0.2 }
                        }}
                        className="bg-c2c-base/95 border-2 border-c2c-orange rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
                    >
                        {sidebarContent}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Collapse/Expand Button */}
            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggle(!isCollapsed);
                }}
                className="bg-c2c-base/95 border-2 border-c2c-orange p-3 rounded-full shadow-xl hover:bg-c2c-base shrink-0 transition-transform duration-150 hover:scale-110 active:scale-95"
                aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
            >
                <div
                    className="transition-transform duration-300"
                    style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
                >
                    <ChevronRight size={18} className="text-c2c-orange" />
                </div>
            </button>

            {/* Filter Modal */}
            <FilterModal
                isOpen={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                filters={searchFilters}
                onFiltersChange={setSearchFilters}
                onApply={() => {}}
            />
        </div>
    );
}
