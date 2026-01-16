'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/auth/Modal';
import { Button } from './Button';
import type { SearchFilters } from '@/lib/store/AppStore';

const DEFAULT_FILTERS: SearchFilters = {
  maxDistance: 10,
  minOverallRating: 0,
  minWifiRating: 0,
  minOutletsRating: 0,
  minCoffeeRating: 0,
  minVibeRating: 0,
  minSeatingRating: 0,
  minNoiseRating: 0,
  minReviews: 0,
  sortBy: 'relevance',
  hasWifi: null,
  hasOutlets: null,
  goodForWork: null,
  quietWorkspace: null,
  spacious: null,
  maxPriceLevel: -1,
};

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onApply: () => void;
}

export function FilterModal({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  onApply,
}: FilterModalProps) {
  const [localFilters, setLocalFilters] = useState<SearchFilters>(filters);

  // Sync local filters with prop changes
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleApply = () => {
    onFiltersChange(localFilters);
    onApply();
    onClose();
  };

  const handleReset = () => {
    setLocalFilters(DEFAULT_FILTERS);
  };

  const hasActiveFilters = JSON.stringify(localFilters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Filter Search Results">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto">
        {/* Distance Filter */}
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">
            Maximum Distance
          </label>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 5, 10, -1].map((miles) => (
              <button
                key={miles}
                type="button"
                onClick={() => setLocalFilters({ ...localFilters, maxDistance: miles })}
                className={`px-4 py-2 rounded-lg border-2 transition-colors text-sm font-medium ${
                  localFilters.maxDistance === miles
                    ? 'bg-c2c-orange text-white border-c2c-orange'
                    : 'bg-white text-gray-900 border-gray-300 hover:border-c2c-orange'
                }`}
              >
                {miles === -1 ? 'Any' : `${miles} mi`}
              </button>
            ))}
          </div>
        </div>

        {/* Sort Option */}
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">
            Sort By
          </label>
          <div className="flex gap-2 flex-wrap">
            {(['relevance', 'distance', 'rating', 'reviews'] as const).map((sort) => (
              <button
                key={sort}
                type="button"
                onClick={() => setLocalFilters({ ...localFilters, sortBy: sort })}
                className={`px-4 py-2 rounded-lg border-2 transition-colors text-sm font-medium capitalize ${
                  localFilters.sortBy === sort
                    ? 'bg-c2c-orange text-white border-c2c-orange'
                    : 'bg-white text-gray-900 border-gray-300 hover:border-c2c-orange'
                }`}
              >
                {sort}
              </button>
            ))}
          </div>
        </div>

        {/* Rating Filters */}
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">
            Minimum Overall Rating
          </label>
          <div className="flex gap-2 flex-wrap">
            {[0, 3, 3.5, 4, 4.5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => setLocalFilters({ ...localFilters, minOverallRating: rating })}
                className={`px-4 py-2 rounded-lg border-2 transition-colors text-sm font-medium ${
                  localFilters.minOverallRating === rating
                    ? 'bg-c2c-orange text-white border-c2c-orange'
                    : 'bg-white text-gray-900 border-gray-300 hover:border-c2c-orange'
                }`}
              >
                {rating === 0 ? 'Any' : `${rating}+ ⭐`}
              </button>
            ))}
          </div>
        </div>

        {/* Review Count */}
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">
            Minimum Reviews
          </label>
          <div className="flex gap-2 flex-wrap">
            {[0, 1, 3, 5, 10].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setLocalFilters({ ...localFilters, minReviews: count })}
                className={`px-4 py-2 rounded-lg border-2 transition-colors text-sm font-medium ${
                  localFilters.minReviews === count
                    ? 'bg-c2c-orange text-white border-c2c-orange'
                    : 'bg-white text-gray-900 border-gray-300 hover:border-c2c-orange'
                }`}
              >
                {count === 0 ? 'Any' : `${count}+`}
              </button>
            ))}
          </div>
        </div>

        {/* Category-Specific Ratings */}
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-3">
            Category Minimums
          </label>
          <div className="space-y-3">
            {[
              { key: 'minWifiRating' as const, label: 'WiFi' },
              { key: 'minOutletsRating' as const, label: 'Outlets' },
              { key: 'minCoffeeRating' as const, label: 'Coffee' },
              { key: 'minVibeRating' as const, label: 'Vibe' },
              { key: 'minSeatingRating' as const, label: 'Seating' },
              { key: 'minNoiseRating' as const, label: 'Noise' },
            ].map(({ key, label }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{label}</span>
                  <span className="text-xs text-gray-500">
                    {localFilters[key] === 0 ? 'Any' : `${localFilters[key]}+ ⭐`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={localFilters[key]}
                  onChange={(e) =>
                    setLocalFilters({ ...localFilters, [key]: parseFloat(e.target.value) })
                  }
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-c2c-orange"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Feature Filters */}
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">
            Features
          </label>
          <div className="space-y-2">
            {[
              { key: 'hasWifi' as const, label: 'Has WiFi' },
              { key: 'hasOutlets' as const, label: 'Has Outlets' },
              { key: 'goodForWork' as const, label: 'Good for Work' },
              { key: 'quietWorkspace' as const, label: 'Quiet Workspace' },
              { key: 'spacious' as const, label: 'Spacious' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localFilters[key] === true}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      [key]: e.target.checked ? true : null,
                    })
                  }
                  className="w-4 h-4 text-c2c-orange border-gray-300 rounded focus:ring-c2c-orange"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Price Level */}
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">
            Maximum Price Level
          </label>
          <div className="flex gap-2 flex-wrap">
            {[-1, 1, 2, 3, 4].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setLocalFilters({ ...localFilters, maxPriceLevel: level })}
                className={`px-4 py-2 rounded-lg border-2 transition-colors text-sm font-medium ${
                  localFilters.maxPriceLevel === level
                    ? 'bg-c2c-orange text-white border-c2c-orange'
                    : 'bg-white text-gray-900 border-gray-300 hover:border-c2c-orange'
                }`}
              >
                {level === -1 ? 'Any' : '$'.repeat(level)}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t-2 border-gray-200">
          <Button
            variant="secondary"
            onClick={handleReset}
            className="flex-1"
            disabled={!hasActiveFilters}
          >
            Reset
          </Button>
          <Button variant="primary" onClick={handleApply} className="flex-1">
            Apply Filters
          </Button>
        </div>
      </div>
    </Modal>
  );
}
