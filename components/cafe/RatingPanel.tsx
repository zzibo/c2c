'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, Edit2, Expand } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Cafe, RatingWithUser } from '@/types/cafe';
import StarRating from '@/components/ui/StarRating';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuth } from '@/lib/auth/AuthContext';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { ImageCarousel } from '@/components/ui/ImageCarousel';

interface RatingPanelProps {
  cafe: Cafe;
  isOpen: boolean;
  onClose: () => void;
  onRatingSubmitted: () => void;
  onExpand?: () => void;
}

interface RatingFormData {
  coffee_rating: number | null;
  vibe_rating: number | null;
  wifi_rating: number | null;
  outlets_rating: number | null;
  seating_rating: number | null;
  noise_rating: number | null;
  comment: string;
  photos: string[];
}

export default function RatingPanel({
  cafe,
  isOpen,
  onClose,
  onRatingSubmitted,
  onExpand,
}: RatingPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<RatingFormData>({
    coffee_rating: null,
    vibe_rating: null,
    wifi_rating: null,
    outlets_rating: null,
    seating_rating: null,
    noise_rating: null,
    comment: '',
    photos: [],
  });

  // ✅ PERFORMANCE FIX: Fetch user's rating with React Query
  const { data: userRatingData } = useQuery({
    queryKey: ['user-rating', cafe.id, user?.id],
    queryFn: async () => {
      if (!user) return { hasRated: false, rating: null };
      const res = await fetch(`/api/ratings/check?cafe_id=${cafe.id}`);
      if (!res.ok) throw new Error('Failed to check rating');
      return res.json();
    },
    enabled: isOpen && !!cafe.id,  // Only fetch when panel is open
    staleTime: 60000,  // Cache for 1 minute
  });

  // ✅ PERFORMANCE FIX: Fetch all ratings with React Query (parallel with above!)
  const { data: ratingsData, isLoading } = useQuery({
    queryKey: ['cafe-ratings', cafe.id],
    queryFn: async () => {
      const res = await fetch(`/api/cafes/${cafe.id}/ratings`);
      if (!res.ok) throw new Error('Failed to fetch ratings');
      return res.json();
    },
    enabled: isOpen && !!cafe.id,  // Only fetch when panel is open
    staleTime: 60000,  // Cache for 1 minute
  });

  const allRatings = ratingsData?.ratings || [];
  const userRating = userRatingData?.rating || null;

  // Extract all photos from ratings for carousel
  const allPhotos = allRatings
    .flatMap((r: RatingWithUser) => r.photos || [])
    .filter(Boolean);

  // Update form when user rating changes
  useEffect(() => {
    if (userRating) {
      setFormData({
        coffee_rating: userRating.coffee_rating,
        vibe_rating: userRating.vibe_rating,
        wifi_rating: userRating.wifi_rating,
        outlets_rating: userRating.outlets_rating,
        seating_rating: userRating.seating_rating,
        noise_rating: userRating.noise_rating,
        comment: userRating.comment || '',
        photos: userRating.photos || [],
      });
    } else {
      // Reset form for new rating
      setFormData({
        coffee_rating: null,
        vibe_rating: null,
        wifi_rating: null,
        outlets_rating: null,
        seating_rating: null,
        noise_rating: null,
        comment: '',
        photos: [],
      });
    }
  }, [userRating]);

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

  // Handle image changes
  const handleImagesChange = (images: string[]) => {
    console.log('📷 RatingPanel received images:', images);
    setFormData((prev) => {
      const newState = {
        ...prev,
        photos: images,
      };
      console.log('📝 Updated formData.photos:', newState.photos);
      return newState;
    });
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

  // ✅ PERFORMANCE FIX: Use React Query mutation with optimistic updates
  const submitMutation = useMutation({
    mutationFn: async (payload: typeof formData & { cafe_id: string }) => {
      const url = userRating ? `/api/ratings/${userRating.id}` : '/api/ratings';
      const method = userRating ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit rating');
      }

      return response.json();
    },
    onMutate: async (payload) => {
      // ✅ Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['cafe-ratings', cafe.id] });
      await queryClient.cancelQueries({ queryKey: ['user-rating', cafe.id, user?.id] });

      // ✅ Snapshot previous values
      const previousRatings = queryClient.getQueryData(['cafe-ratings', cafe.id]);
      const previousUserRating = queryClient.getQueryData(['user-rating', cafe.id, user?.id]);

      // ✅ INSTANT UI UPDATE: Optimistically update cache
      if (user) {
        const optimisticRating = {
          ...payload,
          id: userRating?.id || 'temp-id',
          user_id: user.id,
          username: user.email || 'You',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          overall_rating: calculateOverallRating(payload),
        };

        // Update user rating
        queryClient.setQueryData(['user-rating', cafe.id, user.id], {
          hasRated: true,
          rating: optimisticRating,
        });

        // Update ratings list
        queryClient.setQueryData(['cafe-ratings', cafe.id], (old: any) => {
          if (!old) return { ratings: [optimisticRating], total_count: 1 };

          const existingRatings = old.ratings || [];
          const newRatings = userRating
            ? existingRatings.map((r: any) => r.id === userRating.id ? optimisticRating : r)
            : [optimisticRating, ...existingRatings];

          return {
            ...old,
            ratings: newRatings,
            total_count: newRatings.length,
          };
        });
      }

      return { previousRatings, previousUserRating };
    },
    onError: (err, variables, context) => {
      // ✅ Rollback on error
      if (context) {
        queryClient.setQueryData(['cafe-ratings', cafe.id], context.previousRatings);
        queryClient.setQueryData(['user-rating', cafe.id, user?.id], context.previousUserRating);
      }
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
    },
    onSuccess: () => {
      // ✅ Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['cafe-ratings', cafe.id] });
      queryClient.invalidateQueries({ queryKey: ['user-rating', cafe.id, user?.id] });

      setSuccessMessage(userRating ? 'Rating updated!' : 'Rating submitted!');
      setIsEditing(false);
      setError(null);

      // Notify parent
      onRatingSubmitted();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    },
  });

  // Calculate overall rating from form data
  const calculateOverallRating = (data: typeof formData) => {
    const ratings = [
      data.coffee_rating,
      data.vibe_rating,
      data.wifi_rating,
      data.outlets_rating,
      data.seating_rating,
      data.noise_rating,
    ].filter((r) => r !== null) as number[];

    if (ratings.length === 0) return 0;
    return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  };

  // Submit handler
  const handleSubmit = () => {
    if (!user) {
      setError('Please sign in to submit a rating');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    submitMutation.mutate({ cafe_id: cafe.id, ...formData });
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
        photos: userRating.photos || [],
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
      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full w-[400px] bg-c2c-base border-l-2 border-c2c-orange shadow-xl z-[100] overflow-y-auto"
        style={{ animation: 'slideInRight 300ms ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-c2c-base border-b-2 border-c2c-orange z-10">
          {/* Photo Carousel Section - 15% */}
          <div className="h-[15vh] flex items-center justify-center bg-gray-50 border-b-2 border-c2c-orange relative">
            <ImageCarousel
              images={allPhotos}
              fallbackImage="/assets/c2c-icon.webp"
              className="w-full h-full"
            />
            {/* Expand and Close buttons */}
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
              {onExpand && (
                <button
                  onClick={onExpand}
                  className="p-2 bg-white/80 hover:bg-white rounded transition-colors shadow-sm"
                  aria-label="Expand view"
                >
                  <Expand size={20} className="text-c2c-orange" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 bg-white/80 hover:bg-white rounded transition-colors shadow-sm"
                aria-label="Close panel"
              >
                <X size={20} className="text-c2c-orange" />
              </button>
            </div>
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
              {!user && (
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
                    {userRating.photos && userRating.photos.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        {userRating.photos.map((url: string, idx: number) => (
                          <div key={idx} className="aspect-square rounded overflow-hidden border border-gray-300">
                            <Image
                              src={url}
                              alt={`Photo ${idx + 1}`}
                              width={150}
                              height={150}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // Show rating form
                  <div className="space-y-3">
                    {/* Coffee */}
                    <div className="flex items-center gap-2">
                      <img
                        src="/assets/coffee.webp"
                        alt="Coffee"
                        width={30}
                        height={30}
                        className="object-contain pixel-image flex-shrink-0"
                        loading="eager"
                        decoding="async"
                      />
                      <span className="text-xs text-c2c-orange w-16 flex-shrink-0">Coffee</span>
                      <StarRating
                        rating={formData.coffee_rating || 0}
                        size={20}
                        interactive={!!user}
                        onChange={(rating) => handleRatingChange('coffee_rating', rating)}
                        showNumber={true}
                      />
                    </div>

                    {/* Vibe */}
                    <div className="flex items-center gap-2">
                      <img
                        src="/assets/vibes.webp"
                        alt="Vibe"
                        width={30}
                        height={30}
                        className="object-contain pixel-image flex-shrink-0"
                        loading="eager"
                        decoding="async"
                      />
                      <span className="text-xs text-c2c-orange w-16 flex-shrink-0">Vibe</span>
                      <StarRating
                        rating={formData.vibe_rating || 0}
                        size={20}
                        interactive={!!user}
                        onChange={(rating) => handleRatingChange('vibe_rating', rating)}
                        showNumber={true}
                      />
                    </div>

                    {/* WiFi */}
                    <div className="flex items-center gap-2">
                      <img
                        src="/assets/wifi.webp"
                        alt="WiFi"
                        width={30}
                        height={30}
                        className="object-contain pixel-image flex-shrink-0"
                        loading="eager"
                        decoding="async"
                      />
                      <span className="text-xs text-c2c-orange w-16 flex-shrink-0">WiFi</span>
                      <StarRating
                        rating={formData.wifi_rating || 0}
                        size={20}
                        interactive={!!user}
                        onChange={(rating) => handleRatingChange('wifi_rating', rating)}
                        showNumber={true}
                      />
                    </div>

                    {/* Outlets */}
                    <div className="flex items-center gap-2">
                      <img
                        src="/assets/plugs.webp"
                        alt="Outlets"
                        width={30}
                        height={30}
                        className="object-contain pixel-image flex-shrink-0"
                        loading="eager"
                        decoding="async"
                      />
                      <span className="text-xs text-c2c-orange w-16 flex-shrink-0">Outlets</span>
                      <StarRating
                        rating={formData.outlets_rating || 0}
                        size={20}
                        interactive={!!user}
                        onChange={(rating) => handleRatingChange('outlets_rating', rating)}
                        showNumber={true}
                      />
                    </div>

                    {/* Seating */}
                    <div className="flex items-center gap-2">
                      <img
                        src="/assets/seats.webp"
                        alt="Seating"
                        width={30}
                        height={30}
                        className="object-contain pixel-image flex-shrink-0"
                        loading="eager"
                        decoding="async"
                      />
                      <span className="text-xs text-c2c-orange w-16 flex-shrink-0">Seating</span>
                      <StarRating
                        rating={formData.seating_rating || 0}
                        size={20}
                        interactive={!!user}
                        onChange={(rating) => handleRatingChange('seating_rating', rating)}
                        showNumber={true}
                      />
                    </div>

                    {/* Noise */}
                    <div className="flex items-center gap-2">
                      <img
                        src="/assets/noise.webp"
                        alt="Noise"
                        width={30}
                        height={30}
                        className="object-contain pixel-image flex-shrink-0"
                        loading="eager"
                        decoding="async"
                      />
                      <span className="text-xs text-c2c-orange w-16 flex-shrink-0">Noise</span>
                      <StarRating
                        rating={formData.noise_rating || 0}
                        size={20}
                        interactive={!!user}
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
                        disabled={!user}
                        placeholder="Share your experience..."
                        className="w-full px-3 py-2 text-sm bg-white border border-c2c-orange rounded focus:outline-none focus:ring-2 focus:ring-c2c-orange text-c2c-orange placeholder-c2c-orange/60 disabled:opacity-50 disabled:cursor-not-allowed"
                        rows={3}
                        maxLength={500}
                      />
                      <p className="text-xs text-c2c-orange mt-1">
                        {formData.comment.length}/500 characters
                      </p>
                    </div>

                    {/* Photo Upload */}
                    <div className="mt-3">
                      <label className="text-xs text-c2c-orange block mb-1">
                        Photo (optional)
                      </label>
                      <ImageUpload
                        cafeId={cafe.id}
                        ratingId={userRating?.id}
                        existingImages={formData.photos || []}
                        onImagesChange={handleImagesChange}
                        maxImages={1}
                        disabled={!user}
                      />
                      {/* Debug: Show current photos state */}
                      {formData.photos && formData.photos.length > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ {formData.photos.length} photo(s) ready to submit
                        </p>
                      )}
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={handleSubmit}
                        disabled={!user || submitMutation.isPending}
                        className="flex-1 bg-c2c-orange hover:bg-c2c-orange-dark disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition-all text-sm font-medium"
                      >
                        {submitMutation.isPending
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
                    {allRatings.map((rating: RatingWithUser) => (
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

                        {/* Show photos if any exist */}
                        {rating.photos && rating.photos.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 gap-1">
                            {rating.photos.map((url: string, idx: number) => (
                              <div key={idx} className="aspect-square rounded overflow-hidden border border-c2c-orange/40">
                                <Image
                                  src={url}
                                  alt={`Photo ${idx + 1}`}
                                  width={150}
                                  height={150}
                                  className="w-full h-full object-cover"
                                  unoptimized
                                />
                              </div>
                            ))}
                          </div>
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
      <AuthModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
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
