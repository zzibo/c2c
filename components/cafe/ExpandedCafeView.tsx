'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import type { Cafe, RatingWithUser } from '@/types/cafe';
import StarRating from '@/components/ui/StarRating';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuth } from '@/lib/auth/AuthContext';
import { ImageUpload } from '@/components/ui/ImageUpload';

interface ExpandedCafeViewProps {
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
  photos: string[];
}

export default function ExpandedCafeView({
  cafe,
  isOpen,
  onClose,
  onRatingSubmitted,
}: ExpandedCafeViewProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
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

  // Fetch user's rating
  const { data: userRatingData } = useQuery({
    queryKey: ['user-rating', cafe.id, user?.id],
    queryFn: async () => {
      if (!user) return { hasRated: false, rating: null };
      const res = await fetch(`/api/ratings/check?cafe_id=${cafe.id}`);
      if (!res.ok) throw new Error('Failed to check rating');
      return res.json();
    },
    enabled: isOpen && !!cafe.id,
    staleTime: 60000,
  });

  // Fetch all ratings
  const { data: ratingsData, isLoading } = useQuery({
    queryKey: ['cafe-ratings', cafe.id],
    queryFn: async () => {
      const res = await fetch(`/api/cafes/${cafe.id}/ratings`);
      if (!res.ok) throw new Error('Failed to fetch ratings');
      return res.json();
    },
    enabled: isOpen && !!cafe.id,
    staleTime: 60000,
  });

  const allRatings = ratingsData?.ratings || [];
  const userRating = userRatingData?.rating || null;

  // Extract all photos from ratings for carousel
  const allPhotos = allRatings
    .flatMap((r: RatingWithUser) => r.photos || [])
    .filter(Boolean);

  // Reset image index when photos change
  useEffect(() => {
    setCurrentImageIndex(0);
  }, [allPhotos.length]);

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
    setFormData((prev) => ({
      ...prev,
      photos: images,
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

  // Submit mutation
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
      await queryClient.cancelQueries({ queryKey: ['cafe-ratings', cafe.id] });
      await queryClient.cancelQueries({ queryKey: ['user-rating', cafe.id, user?.id] });

      const previousRatings = queryClient.getQueryData(['cafe-ratings', cafe.id]);
      const previousUserRating = queryClient.getQueryData(['user-rating', cafe.id, user?.id]);

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

        queryClient.setQueryData(['user-rating', cafe.id, user.id], {
          hasRated: true,
          rating: optimisticRating,
        });

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
      if (context) {
        queryClient.setQueryData(['cafe-ratings', cafe.id], context.previousRatings);
        queryClient.setQueryData(['user-rating', cafe.id, user?.id], context.previousUserRating);
      }
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-ratings', cafe.id] });
      queryClient.invalidateQueries({ queryKey: ['user-rating', cafe.id, user?.id] });

      setSuccessMessage(userRating ? 'Rating updated!' : 'Rating submitted!');
      setIsEditing(false);
      setError(null);

      onRatingSubmitted();

      setTimeout(() => setSuccessMessage(null), 3000);
    },
  });

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

  // Image navigation
  const handlePreviousImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? allPhotos.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === allPhotos.length - 1 ? 0 : prev + 1));
  };

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayImages = allPhotos.length > 0 ? allPhotos : ['/assets/c2c-icon.webp'];
  const showImageControls = allPhotos.length > 1;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Dimmed Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/60 z-[200]"
              onClick={onClose}
            />

            {/* Expanded View Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-4 md:inset-8 z-[201] flex rounded-2xl overflow-hidden shadow-2xl"
            >
              {/* Left Side - Image Carousel (60%) */}
              <div className="w-[60%] bg-gray-900 relative flex items-center justify-center">
                {/* Main Image */}
                <div className="w-full h-full flex items-center justify-center p-8">
                  <Image
                    src={displayImages[currentImageIndex]}
                    alt={allPhotos.length > 0 ? `Cafe photo ${currentImageIndex + 1}` : 'C2C Logo'}
                    fill
                    className="object-contain"
                    unoptimized
                    priority
                  />
                </div>

                {/* Navigation Arrows */}
                {showImageControls && (
                  <>
                    <button
                      onClick={handlePreviousImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/90 hover:bg-white rounded-full transition-colors shadow-lg"
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={28} className="text-c2c-orange" />
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/90 hover:bg-white rounded-full transition-colors shadow-lg"
                      aria-label="Next image"
                    >
                      <ChevronRight size={28} className="text-c2c-orange" />
                    </button>
                  </>
                )}

                {/* Image Counter */}
                {showImageControls && (
                  <div className="absolute top-4 left-4 px-3 py-2 bg-black/70 text-white text-sm rounded-lg">
                    {currentImageIndex + 1} / {allPhotos.length}
                  </div>
                )}

                {/* No Photos Placeholder */}
                {allPhotos.length === 0 && (
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-sm">
                    No photos yet - be the first to add one!
                  </div>
                )}
              </div>

              {/* Right Side - Cafe Details (40%) */}
              <div className="w-[40%] bg-c2c-base flex flex-col h-full">
                {/* Header with Close Button */}
                <div className="p-6 border-b-2 border-c2c-orange flex items-start justify-between">
                  <div className="flex-1 pr-4">
                    <h2 className="text-xl font-bold text-c2c-orange mb-2">{cafe.name}</h2>
                    {cafe.address && (
                      <p className="text-sm text-c2c-orange/80 mb-3">{cafe.address}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <StarRating
                        rating={cafe.ratings.overall}
                        size={20}
                        showNumber={true}
                      />
                      {cafe.totalReviews > 0 && (
                        <span className="text-sm text-c2c-orange">
                          ({cafe.totalReviews} {cafe.totalReviews === 1 ? 'review' : 'reviews'})
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-c2c-orange/10 rounded-full transition-colors"
                    aria-label="Close expanded view"
                  >
                    <X size={24} className="text-c2c-orange" />
                  </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6">
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
                        <h3 className="text-sm font-bold text-c2c-orange mb-4 uppercase tracking-wide">
                          Your Rating
                        </h3>

                        {userRating && !isEditing ? (
                          // Show existing rating (read-only)
                          <div className="bg-gray-50 border-2 border-gray-400 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-900">
                                You rated this cafe{' '}
                                <span className="font-bold">{userRating.overall_rating.toFixed(1)}★</span>
                              </span>
                              <button
                                onClick={handleEdit}
                                className="p-2 hover:bg-gray-200 rounded transition-colors"
                                aria-label="Edit rating"
                              >
                                <Edit2 size={16} className="text-gray-900" />
                              </button>
                            </div>
                            <p className="text-xs text-gray-700">
                              {formatDate(userRating.updated_at)}
                            </p>
                            {userRating.comment && (
                              <p className="text-sm text-gray-900 mt-3 italic">
                                "{userRating.comment}"
                              </p>
                            )}
                            {userRating.photos && userRating.photos.length > 0 && (
                              <div className="mt-3 grid grid-cols-2 gap-2">
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
                          <div className="space-y-4">
                            {/* Rating Categories */}
                            {[
                              { key: 'coffee_rating', label: 'Coffee', icon: '/assets/coffee.webp' },
                              { key: 'vibe_rating', label: 'Vibe', icon: '/assets/vibes.webp' },
                              { key: 'wifi_rating', label: 'WiFi', icon: '/assets/wifi.webp' },
                              { key: 'outlets_rating', label: 'Outlets', icon: '/assets/plugs.webp' },
                              { key: 'seating_rating', label: 'Seating', icon: '/assets/seats.webp' },
                              { key: 'noise_rating', label: 'Noise', icon: '/assets/noise.webp' },
                            ].map(({ key, label, icon }) => (
                              <div key={key} className="flex items-center gap-3">
                                <img
                                  src={icon}
                                  alt={label}
                                  width={32}
                                  height={32}
                                  className="object-contain pixel-image flex-shrink-0"
                                  loading="eager"
                                />
                                <span className="text-sm text-c2c-orange w-20 flex-shrink-0 font-medium">
                                  {label}
                                </span>
                                <StarRating
                                  rating={(formData[key as keyof RatingFormData] as number) || 0}
                                  size={24}
                                  interactive={!!user}
                                  onChange={(rating) => handleRatingChange(key as keyof RatingFormData, rating)}
                                  showNumber={true}
                                />
                              </div>
                            ))}

                            {/* Comment */}
                            <div className="mt-4">
                              <label className="text-sm text-c2c-orange block mb-2 font-medium">
                                Comment (optional)
                              </label>
                              <textarea
                                value={formData.comment}
                                onChange={handleCommentChange}
                                disabled={!user}
                                placeholder="Share your experience..."
                                className="w-full px-4 py-3 text-sm bg-white border-2 border-c2c-orange rounded-lg focus:outline-none focus:ring-2 focus:ring-c2c-orange text-c2c-orange placeholder-c2c-orange/60 disabled:opacity-50 disabled:cursor-not-allowed"
                                rows={4}
                                maxLength={500}
                              />
                              <p className="text-xs text-c2c-orange mt-1">
                                {formData.comment.length}/500 characters
                              </p>
                            </div>

                            {/* Photo Upload */}
                            <div className="mt-4">
                              <label className="text-sm text-c2c-orange block mb-2 font-medium">
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
                              {formData.photos && formData.photos.length > 0 && (
                                <p className="text-xs text-green-600 mt-1">
                                  {formData.photos.length} photo(s) ready to submit
                                </p>
                              )}
                            </div>

                            {/* Submit Buttons */}
                            <div className="flex gap-3 mt-6">
                              <button
                                onClick={handleSubmit}
                                disabled={!user || submitMutation.isPending}
                                className="flex-1 bg-c2c-orange hover:bg-c2c-orange-dark disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-all text-sm font-medium"
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
                                  className="px-6 py-3 bg-white hover:bg-gray-100 text-c2c-orange border-2 border-c2c-orange rounded-lg transition-all text-sm font-medium"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ALL REVIEWS SECTION */}
                      <div className="border-t-2 border-c2c-orange/40 pt-6">
                        <h3 className="text-sm font-bold text-c2c-orange mb-4 uppercase tracking-wide">
                          All Reviews ({allRatings.length})
                        </h3>

                        {allRatings.length === 0 ? (
                          <div className="text-center py-8 text-c2c-orange">
                            <p className="text-sm">No reviews yet.</p>
                            <p className="text-xs mt-1">Be the first to rate this cafe!</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {allRatings.map((rating: RatingWithUser) => (
                              <div
                                key={rating.id}
                                className="bg-white border-2 border-c2c-orange/40 rounded-lg p-4"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <p className="text-sm font-semibold text-c2c-orange">
                                      {rating.username}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <StarRating rating={rating.overall_rating} size={14} />
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
                                  <p className="text-sm text-c2c-orange mt-3">{rating.comment}</p>
                                )}

                                {/* Show photos if any exist */}
                                {rating.photos && rating.photos.length > 0 && (
                                  <div className="mt-3 grid grid-cols-2 gap-2">
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
                                  <div className="mt-3 pt-3 border-t border-c2c-orange/20 grid grid-cols-2 gap-2 text-xs text-c2c-orange">
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
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <AuthModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </>
  );
}
