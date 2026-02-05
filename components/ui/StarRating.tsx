'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';

interface StarRatingProps {
  rating: number; // Current rating (0-5, can be 0.5 increments)
  maxStars?: number; // Maximum number of stars (default 5)
  size?: number; // Size of each star in pixels
  interactive?: boolean; // Whether stars respond to hover/click
  onChange?: (rating: number) => void; // Callback when rating changes
  showNumber?: boolean; // Show numerical rating next to stars
}

export default function StarRating({
  rating = 0,
  maxStars = 5,
  size = 16,
  interactive = false,
  onChange,
  showNumber = false,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isTouching, setIsTouching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate which rating to display (hover takes precedence)
  const displayRating = hoverRating !== null ? hoverRating : rating;

  // Memoized rating calculation to avoid redundant getBoundingClientRect calls
  const calculateRating = useCallback((clientX: number): number | null => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const starWidth = rect.width / maxStars;
    const starIndex = Math.floor(x / starWidth);
    const positionInStar = (x % starWidth) / starWidth;

    // Determine if position is on left half (0.5) or right half (1.0)
    let newRating = positionInStar < 0.5 ? starIndex + 0.5 : starIndex + 1;

    // Clamp between 0 and maxStars
    return Math.max(0, Math.min(maxStars, newRating));
  }, [maxStars]);

  // Handle pointer move (unified mouse/touch) - only update if rating changed
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || isTouching) return;

    const newRating = calculateRating(e.clientX);
    if (newRating !== null) {
      setHoverRating(prev => prev === newRating ? prev : newRating);
    }
  }, [interactive, isTouching, calculateRating]);

  const handlePointerLeave = useCallback(() => {
    if (!interactive || isTouching) return;
    setHoverRating(null);
  }, [interactive, isTouching]);

  // Touch-specific handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!interactive) return;
    setIsTouching(true);
    const touch = e.touches[0];
    const newRating = calculateRating(touch.clientX);
    if (newRating !== null) {
      setHoverRating(newRating);
    }
  }, [interactive, calculateRating]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!interactive) return;
    e.preventDefault(); // Prevent scrolling while rating
    const touch = e.touches[0];
    const newRating = calculateRating(touch.clientX);
    if (newRating !== null) {
      setHoverRating(prev => prev === newRating ? prev : newRating);
    }
  }, [interactive, calculateRating]);

  const handleTouchEnd = useCallback(() => {
    if (!interactive) {
      setIsTouching(false);
      return;
    }

    if (hoverRating !== null) {
      onChange?.(hoverRating);
    }

    setIsTouching(false);
    // Keep hover rating visible briefly for feedback, then clear
    setTimeout(() => setHoverRating(null), 200);
  }, [interactive, hoverRating, onChange]);

  const handleClick = useCallback(() => {
    if (!interactive || hoverRating === null) return;
    onChange?.(hoverRating);
  }, [interactive, hoverRating, onChange]);

  // Render individual star based on position
  const renderStar = (index: number) => {
    const starValue = index + 1;
    let starType: 'zero' | 'half' | 'full' = 'zero';

    // Determine star type based on display rating
    if (displayRating >= starValue) {
      starType = 'full';
    } else if (displayRating >= starValue - 0.5) {
      starType = 'half';
    } else {
      starType = 'zero';
    }

    const starImage =
      starType === 'full'
        ? '/assets/full_star.webp'
        : starType === 'half'
        ? '/assets/half_star.webp'
        : '/assets/zero_star.webp';

    return (
      <div
        key={index}
        className="inline-block"
        style={{ width: size, height: size }}
      >
        <Image
          src={starImage}
          alt={`${starType} star`}
          width={size}
          height={size}
          className="object-contain pixel-image"
          unoptimized
          priority={index < 5}
          fetchPriority={index < 5 ? "high" : "auto"}
          draggable={false}
        />
      </div>
    );
  };

  return (
    <div className="flex items-center gap-1">
      <div
        ref={containerRef}
        className={`flex items-center ${interactive ? 'cursor-pointer' : ''}`}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        style={{
          userSelect: 'none',
          touchAction: interactive ? 'none' : 'auto', // Prevent scroll during rating
          // Add extra padding for larger touch target without affecting visual layout
          padding: interactive ? '8px 0' : '0',
          margin: interactive ? '-8px 0' : '0',
        }}
      >
        {Array.from({ length: maxStars }, (_, i) => renderStar(i))}
      </div>

      {showNumber && (
        <span className="text-xs font-medium text-c2c-orange ml-1">
          {displayRating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
