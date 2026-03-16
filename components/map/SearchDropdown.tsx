'use client';

import React, { useEffect, useRef } from 'react';
import { MapPin, Star } from 'lucide-react';
import type { Cafe, AddressSuggestion } from '@/types/cafe';

interface SearchDropdownProps {
  cafeResults: Cafe[];
  addressResults: AddressSuggestion[];
  isLoading: boolean;
  onSelectCafe: (cafe: Cafe) => void;
  onSelectAddress: (address: AddressSuggestion) => void;
  onClose: () => void;
}

export function SearchDropdown({
  cafeResults,
  addressResults,
  isLoading,
  onSelectCafe,
  onSelectAddress,
  onClose,
}: SearchDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const hasResults = cafeResults.length > 0 || addressResults.length > 0;

  if (!hasResults && !isLoading) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto"
    >
      {isLoading && !hasResults && (
        <div className="px-3 py-3 text-xs text-gray-500 flex items-center gap-2">
          <div className="animate-spin h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full" />
          Searching...
        </div>
      )}

      {/* Cafe Results */}
      {cafeResults.length > 0 && (
        <>
          <div className="px-3 pt-2 pb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
            Cafes
          </div>
          {cafeResults.map((cafe) => (
            <button
              key={cafe.id}
              type="button"
              onClick={() => onSelectCafe(cafe)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-start gap-2"
            >
              <span className="text-c2c-orange mt-0.5 shrink-0">&#9749;</span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {cafe.name}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  {cafe.distance != null && (
                    <span>
                      {(cafe.distance / 1609.34).toFixed(1)} mi
                    </span>
                  )}
                  {cafe.ratings.overall > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Star size={10} className="fill-c2c-orange text-c2c-orange" />
                      {cafe.ratings.overall.toFixed(1)}
                    </span>
                  )}
                  {cafe.totalReviews > 0 && (
                    <span>
                      {cafe.totalReviews} {cafe.totalReviews === 1 ? 'review' : 'reviews'}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </>
      )}

      {/* Address Results */}
      {addressResults.length > 0 && (
        <>
          <div className="px-3 pt-2 pb-1 text-xs font-medium text-gray-500 uppercase tracking-wide border-t border-gray-100">
            Addresses
          </div>
          {addressResults.map((addr, i) => (
            <button
              key={`addr-${i}`}
              type="button"
              onClick={() => onSelectAddress(addr)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-start gap-2"
            >
              <MapPin size={14} className="text-gray-500 mt-0.5 shrink-0" />
              <span className="text-sm text-gray-700 truncate">{addr.label}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
