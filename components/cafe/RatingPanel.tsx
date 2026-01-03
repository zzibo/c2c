'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, Edit2 } from 'lucide-react';
import type { Cafe, Rating, RatingWithUser } from '@/types/cafe';
import StarRating from '@/components/ui/StarRating';
import LoginModal from '@/components/auth/LoginModal';
import { getSession } from '@/lib/auth';

interface RatingPanelProps {
  cafe: Cafe;
  isOpen: boolean;
  onClose: () => void;
  onRatingSubmitted: () => void;
}

interface RatingFormData {
  coffee_rating: number | null;
  vibe_rating: number | null;
  wifi_rating: number | null;
  outlets_rating: number | null;
  seating_rating: number | null;
  noise_rating: number | null;
  comment: string;
}

export default function RatingPanel({
  cafe,
  isOpen,
  onClose,
  onRatingSubmitted,
}: RatingPanelProps) {
  const [userRating, setUserRating] = useState<Rating | null>(null);
  const [allRatings, setAllRatings] = useState<RatingWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [formData, setFormData] = useState<RatingFormData>({
    coffee_rating: null,
    vibe_rating: null,
    wifi_rating: null,
    outlets_rating: null,
    seating_rating: null,
    noise_rating: null,
    comment: '',
  });

  // Check authentication and fetch data
  useEffect(() => {
    if (!isOpen || !cafe) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Check if user is authenticated
        const session = await getSession();
        setIsAuthenticated(!!session);

        // Fetch user's existing rating (if authenticated)
        if (session) {
          const checkResponse = await fetch(
            `/api/ratings/check?cafe_id=${cafe.id}`
          );
          const checkData = await checkResponse.json();

          if (checkData.hasRated && checkData.rating) {
            setUserRating(checkData.rating);
            setFormData({
              coffee_rating: checkData.rating.coffee_rating,
              vibe_rating: checkData.rating.vibe_rating,
              wifi_rating: checkData.rating.wifi_rating,
              outlets_rating: checkData.rating.outlets_rating,
              seating_rating: checkData.rating.seating_rating,
              noise_rating: checkData.rating.noise_rating,
              comment: checkData.rating.comment || '',
            });
          } else {
            setUserRating(null);
            // Reset form for new rating
            setFormData({
              coffee_rating: null,
              vibe_rating: null,
              wifi_rating: null,
              outlets_rating: null,
              seating_rating: null,
              noise_rating: null,
              comment: '',
            });
          }
        }

        // Fetch all ratings for this cafe
        const ratingsResponse = await fetch(`/api/cafes/${cafe.id}/ratings`);
        const ratingsData = await ratingsResponse.json();

        if (ratingsData.ratings) {
          setAllRatings(ratingsData.ratings);
        }
      } catch (err) {
        console.error('Error fetching ratings:', err);
        setError('Failed to load ratings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isOpen, cafe]);

  // Handle rating changes
  const handleRatingChange = (category: keyof RatingFormData, value: number) => {
    setFormData((prev) => ({
      ...prev,
      [category]: value,
    }));
  };

  // Handle comment change
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      comment: e.target.value,
    }));
  };

  // Validate form
  const validateForm = (): string | null => {
    const hasAtLeastOneRating = [
      formData.coffee_rating,
      formData.vibe_rating,
      formData.wifi_rating,
      formData.outlets_rating,
      formData.seating_rating,
      formData.noise_rating,
    ].some((rating) => rating !== null);

    if (!hasAtLeastOneRating) {
      return 'Please rate at least one category';
    }

    return null;
  };

  // Submit rating
  const handleSubmit = async () => {
    if (!isAuthenticated) {
      setError('Please sign in to submit a rating');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        cafe_id: cafe.id,
        ...formData,
      };

      let response;
      if (userRating) {
        // Update existing rating
        response = await fetch(`/api/ratings/${userRating.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new rating
        response = await fetch('/api/ratings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit rating');
      }

      // Success!
      setSuccessMessage(userRating ? 'Rating updated!' : 'Rating submitted!');
      setUserRating(data.rating);
      setIsEditing(false);

      // Refresh data
      onRatingSubmitted();

      // Reload ratings list
      const ratingsResponse = await fetch(`/api/cafes/${cafe.id}/ratings`);
      const ratingsData = await ratingsResponse.json();
      if (ratingsData.ratings) {
        setAllRatings(ratingsData.ratings);
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (err) {
      console.error('Error submitting rating:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit mode
  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset form to existing rating
    if (userRating) {
      setFormData({
        coffee_rating: userRating.coffee_rating,
        vibe_rating: userRating.vibe_rating,
        wifi_rating: userRating.wifi_rating,
        outlets_rating: userRating.outlets_rating,
        seating_rating: userRating.seating_rating,
        noise_rating: userRating.noise_rating,
        comment: userRating.comment || '',
      });
    }
  };

  // Format timestamp
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  if (!isOpen) {
    console.log('RatingPanel: isOpen is false, not rendering');
    return null;
  }

  console.log('RatingPanel: Rendering for cafe:', cafe.name);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-30 z-[200]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full w-[400px] bg-c2c-base border-l-2 border-c2c-orange shadow-xl z-[210] overflow-y-auto"
        style={{ animation: 'slideInRight 300ms ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-c2c-base border-b-2 border-c2c-orange z-10">
          {/* Logo Section - 15% */}
          <div className="h-[15vh] flex items-center justify-center bg-gray-50 border-b-2 border-c2c-orange relative">
            <Image
              src="/assets/c2c-icon.png"
              alt="C2C"
              width={80}
              height={80}
              className="object-contain pixel-image"
              unoptimized
            />
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-gray-200 rounded transition-colors"
              aria-label="Close panel"
            >
              <X size={20} className="text-c2c-orange" />
            </button>
          </div>

          {/* Cafe Info */}
          <div className="p-4 bg-c2c-base">
            <h2 className="text-lg font-bold text-c2c-orange mb-1">{cafe.name}</h2>
            {cafe.address && (
              <p className="text-xs text-c2c-orange mb-2">{cafe.address}</p>
            )}
            <div className="flex items-center gap-2">
              <StarRating
                rating={cafe.ratings.overall}
                size={16}
                showNumber={true}
              />
              {cafe.totalReviews > 0 && (
                <span className="text-xs text-c2c-orange">
                  ({cafe.totalReviews} {cafe.totalReviews === 1 ? 'review' : 'reviews'})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-700">
              <div className="animate-spin h-8 w-8 border-2 border-c2c-orange border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm">Loading ratings...</p>
            </div>
          ) : (
            <>
              {/* Success Message */}
              {successMessage && (
                <div className="mb-4 bg-green-100 text-green-800 px-4 py-2 rounded border border-green-300 text-sm">
                  {successMessage}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mb-4 bg-red-100 text-red-800 px-4 py-2 rounded border border-red-300 text-sm">
                  {error}
                </div>
              )}

              {/* Authentication Warning */}
              {!isAuthenticated && (
                <div className="mb-4 bg-c2c-orange/10 text-c2c-orange px-4 py-3 rounded border border-c2c-orange/30">
                  <p className="text-sm mb-2">Please sign in to rate this cafe</p>
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="w-full bg-c2c-orange hover:bg-c2c-orange-dark text-white px-4 py-2 rounded transition-all text-sm font-medium"
                  >
                    Sign In
                  </button>
                </div>
              )}

              {/* YOUR RATING SECTION */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-c2c-orange mb-3 uppercase">
                  Your Rating
                </h3>

                {userRating && !isEditing ? (
                  // Show existing rating (read-only)
                  <div className="bg-gray-50 border-2 border-gray-400 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-900">
                        You rated this cafe{' '}
                        <span className="font-bold">{userRating.overall_rating.toFixed(1)}★</span>
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={handleEdit}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                          aria-label="Edit rating"
                        >
                          <Edit2 size={14} className="text-gray-900" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-700">
                      {formatDate(userRating.updated_at)}
                    </p>
                    {userRating.comment && (
                      <p className="text-sm text-gray-900 mt-2 italic">
                        "{userRating.comment}"
                      </p>
                    )}
                  </div>
                ) : (
                  // Show rating form
                  <div className="space-y-3">
                    {/* Coffee */}
                    <div className="flex items-center gap-2">
                      <Image
                        src="/assets/coffee.png"
                        alt="Coffee"
                        width={30}
                        height={30}
                        className="object-contain pixel-image flex-shrink-0"
                        unoptimized
                      />
                      <span className="text-xs text-c2c-orange w-16 flex-shrink-0">Coffee</span>
                      <StarRating
                        rating={formData.coffee_rating || 0}
                        size={20}
                        interactive={isAuthenticated}
                        onChange={(rating) => handleRatingChange('coffee_rating', rating)}
                        showNumber={true}
                      />
                    </div>

                    {/* Vibe */}
                    <div className="flex items-center gap-2">
                      <Image
                        src="/assets/vibes.png"
                        alt="Vibe"
                        width={30}
                        height={30}
                        className="object-contain pixel-image flex-shrink-0"
                        unoptimized
                      />
                      <span className="text-xs text-c2c-orange w-16 flex-shrink-0">Vibe</span>
                      <StarRating
                        rating={formData.vibe_rating || 0}
                        size={20}
                        interactive={isAuthenticated}
                        onChange={(rating) => handleRatingChange('vibe_rating', rating)}
                        showNumber={true}
                      />
                    </div>

                    {/* WiFi */}
                    <div className="flex items-center gap-2">
                      <Image
                        src="/assets/wifi.png"
                        alt="WiFi"
                        width={30}
                        height={30}
                        className="object-contain pixel-image flex-shrink-0"
                        unoptimized
                      />
                      <span className="text-xs text-c2c-orange w-16 flex-shrink-0">WiFi</span>
                      <StarRating
                        rating={formData.wifi_rating || 0}
                        size={20}
                        interactive={isAuthenticated}
                        onChange={(rating) => handleRatingChange('wifi_rating', rating)}
                        showNumber={true}
                      />
                    </div>

                    {/* Outlets */}
                    <div className="flex items-center gap-2">
                      <Image
                        src="/assets/plugs.png"
                        alt="Outlets"
                          width={30}
                          height={30}
                        className="object-contain pixel-image flex-shrink-0"
                        unoptimized
                      />
                      <span className="text-xs text-c2c-orange w-16 flex-shrink-0">Outlets</span>
                      <StarRating
                        rating={formData.outlets_rating || 0}
                        size={20}
                        interactive={isAuthenticated}
                        onChange={(rating) => handleRatingChange('outlets_rating', rating)}
                        showNumber={true}
                      />
                    </div>

                    {/* Seating */}
                    <div className="flex items-center gap-2">
                      <Image
                        src="/assets/seats.png"
                        alt="Seating"
                          width={30}
                          height={30}
                        className="object-contain pixel-image flex-shrink-0"
                        unoptimized
                      />
                      <span className="text-xs text-c2c-orange w-16 flex-shrink-0">Seating</span>
                      <StarRating
                        rating={formData.seating_rating || 0}
                        size={20}
                        interactive={isAuthenticated}
                        onChange={(rating) => handleRatingChange('seating_rating', rating)}
                        showNumber={true}
                      />
                    </div>

                    {/* Noise */}
                    <div className="flex items-center gap-2">
                      <Image
                        src="/assets/noise.png"
                        alt="Noise"
                          width={30}
                          height={30}
                        className="object-contain pixel-image flex-shrink-0"
                        unoptimized
                      />
                      <span className="text-xs text-c2c-orange w-16 flex-shrink-0">Noise</span>
                      <StarRating
                        rating={formData.noise_rating || 0}
                        size={20}
                        interactive={isAuthenticated}
                        onChange={(rating) => handleRatingChange('noise_rating', rating)}
                        showNumber={true}
                      />
                    </div>

                    {/* Comment */}
                    <div className="mt-3">
                      <label className="text-xs text-c2c-orange block mb-1">
                        Comment (optional)
                      </label>
                      <textarea
                        value={formData.comment}
                        onChange={handleCommentChange}
                        disabled={!isAuthenticated}
                        placeholder="Share your experience..."
                        className="w-full px-3 py-2 text-sm bg-white border border-c2c-orange rounded focus:outline-none focus:ring-2 focus:ring-c2c-orange text-c2c-orange placeholder-c2c-orange/60 disabled:opacity-50 disabled:cursor-not-allowed"
                        rows={3}
                        maxLength={500}
                      />
                      <p className="text-xs text-c2c-orange mt-1">
                        {formData.comment.length}/500 characters
                      </p>
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={handleSubmit}
                        disabled={!isAuthenticated || isSubmitting}
                        className="flex-1 bg-c2c-orange hover:bg-c2c-orange-dark disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition-all text-sm font-medium"
                      >
                        {isSubmitting
                          ? 'Submitting...'
                          : userRating
                          ? 'Update Rating'
                          : 'Submit Rating'}
                      </button>
                      {isEditing && (
                        <button
                          onClick={handleCancelEdit}
                          className="px-4 py-2 bg-c2c-base hover:bg-c2c-base/70 text-c2c-orange border border-c2c-orange rounded transition-all text-sm font-medium"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ALL REVIEWS SECTION */}
              <div className="border-t-2 border-c2c-orange/40 pt-4">
                <h3 className="text-sm font-bold text-c2c-orange mb-3 uppercase">
                  All Reviews ({allRatings.length})
                </h3>

                {allRatings.length === 0 ? (
                  <div className="text-center py-8 text-c2c-orange">
                    <p className="text-sm">No reviews yet.</p>
                    <p className="text-xs mt-1">Be the first to rate this cafe!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allRatings.map((rating) => (
                      <div
                        key={rating.id}
                        className="bg-white border border-c2c-orange/40 rounded p-3"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-sm font-semibold text-c2c-orange">
                              {rating.username}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <StarRating rating={rating.overall_rating} size={12} />
                              <span className="text-xs text-c2c-orange">
                                {rating.overall_rating.toFixed(1)}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-c2c-orange">
                            {formatDate(rating.created_at)}
                          </span>
                        </div>

                        {rating.comment && (
                          <p className="text-sm text-c2c-orange mt-2">{rating.comment}</p>
                        )}

                        {/* Show category ratings if any exist */}
                        {(rating.coffee_rating ||
                          rating.vibe_rating ||
                          rating.wifi_rating ||
                          rating.outlets_rating ||
                          rating.seating_rating ||
                          rating.noise_rating) && (
                          <div className="mt-2 pt-2 border-t border-c2c-orange/20 text-xs text-c2c-orange space-y-1">
                            {rating.coffee_rating && (
                              <div>☕ Coffee: {rating.coffee_rating.toFixed(1)}</div>
                            )}
                            {rating.vibe_rating && (
                              <div>🎵 Vibe: {rating.vibe_rating.toFixed(1)}</div>
                            )}
                            {rating.wifi_rating && (
                              <div>📶 WiFi: {rating.wifi_rating.toFixed(1)}</div>
                            )}
                            {rating.outlets_rating && (
                              <div>🔌 Outlets: {rating.outlets_rating.toFixed(1)}</div>
                            )}
                            {rating.seating_rating && (
                              <div>💺 Seating: {rating.seating_rating.toFixed(1)}</div>
                            )}
                            {rating.noise_rating && (
                              <div>🔊 Noise: {rating.noise_rating.toFixed(1)}</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={async () => {
          // Refresh authentication status
          const session = await getSession();
          setIsAuthenticated(!!session);

          // Reload user rating and all ratings
          if (session) {
            try {
              const checkResponse = await fetch(`/api/ratings/check?cafe_id=${cafe.id}`);
              const checkData = await checkResponse.json();
              if (checkData.hasRated && checkData.rating) {
                setUserRating(checkData.rating);
                setFormData({
                  coffee_rating: checkData.rating.coffee_rating,
                  vibe_rating: checkData.rating.vibe_rating,
                  wifi_rating: checkData.rating.wifi_rating,
                  outlets_rating: checkData.rating.outlets_rating,
                  seating_rating: checkData.rating.seating_rating,
                  noise_rating: checkData.rating.noise_rating,
                  comment: checkData.rating.comment || '',
                });
              }
            } catch (err) {
              console.error('Error refreshing after login:', err);
            }
          }
        }}
      />

      {/* Add CSS animation */}
      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
