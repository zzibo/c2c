'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { Coordinate } from '@/types/cafe';

interface AddCafeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; googleMapsLink: string }) => Promise<void>;
  location: Coordinate;
}

export function AddCafeModal({ isOpen, onClose, onSubmit, location }: AddCafeModalProps) {
  const [cafeName, setCafeName] = useState('');
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!cafeName.trim()) {
      setError('Please enter a cafe name');
      return;
    }

    if (!googleMapsLink.trim()) {
      setError('Please enter a Google Maps link');
      return;
    }

    // Validate Google Maps link format
    const googleMapsPattern = /^https:\/\/(www\.)?google\.[a-z]+\/maps/i;
    if (!googleMapsPattern.test(googleMapsLink)) {
      setError('Please enter a valid Google Maps link (e.g., https://maps.google.com/...)');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({ name: cafeName, googleMapsLink });
      // Reset form on success
      setCafeName('');
      setGoogleMapsLink('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit cafe');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setCafeName('');
      setGoogleMapsLink('');
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white border-2 border-gray-900 shadow-lg w-full max-w-md mx-4 rounded-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-gray-300">
          <h2 className="text-lg font-bold text-gray-900 font-sans">Add a Cafe</h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Location display */}
          <div className="bg-gray-50 border border-gray-300 px-3 py-2 rounded-lg">
            <p className="text-xs text-gray-500 font-medium font-sans mb-1">Location</p>
            <p className="text-sm text-gray-900 font-sans">
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </p>
          </div>

          {/* Cafe Name */}
          <div>
            <label htmlFor="cafeName" className="block text-sm font-medium text-gray-900 font-sans mb-2">
              Cafe Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              id="cafeName"
              value={cafeName}
              onChange={(e) => setCafeName(e.target.value)}
              placeholder="e.g., Blue Bottle Coffee"
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-400 bg-white text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-c2c-orange focus:border-c2c-orange
                         disabled:opacity-50 disabled:cursor-not-allowed font-sans text-sm rounded-lg"
            />
          </div>

          {/* Google Maps Link */}
          <div>
            <label htmlFor="googleMapsLink" className="block text-sm font-medium text-gray-900 font-sans mb-2">
              Google Maps Link <span className="text-red-600">*</span>
            </label>
            <input
              type="url"
              id="googleMapsLink"
              value={googleMapsLink}
              onChange={(e) => setGoogleMapsLink(e.target.value)}
              placeholder="https://maps.google.com/..."
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-400 bg-white text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-c2c-orange focus:border-c2c-orange
                         disabled:opacity-50 disabled:cursor-not-allowed font-sans text-sm rounded-lg"
            />
            <p className="text-xs text-gray-500 font-sans mt-1">
              Paste the link from Google Maps (e.g., right-click on the location and select "Copy link")
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-400 px-3 py-2 rounded-lg">
              <p className="text-sm text-red-700 font-sans">{error}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-white border border-gray-700 text-gray-900 font-medium
                         hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                         font-sans text-sm rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-c2c-orange text-white font-medium
                         hover:bg-c2c-orange-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                         font-sans text-sm rounded-lg"
            >
              {isSubmitting ? 'Submitting...' : 'Add Cafe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
