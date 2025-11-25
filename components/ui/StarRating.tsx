'use client';

import { useState, useRef } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate which rating to display (hover takes precedence)
  const displayRating = hoverRating !== null ? hoverRating : rating;

  // Handle mouse move across stars - calculate half-star precision
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const starWidth = rect.width / maxStars;
    const starIndex = Math.floor(x / starWidth);
    const positionInStar = (x % starWidth) / starWidth;

    // Determine if hover is on left half (0.5) or right half (1.0)
    let newRating: number;
    if (positionInStar < 0.5) {
      newRating = starIndex + 0.5;
    } else {
      newRating = starIndex + 1;
    }

    // Clamp between 0 and maxStars
    newRating = Math.max(0, Math.min(maxStars, newRating));

    setHoverRating(newRating);
  };

  const handleMouseLeave = () => {
    if (!interactive) return;
    setHoverRating(null);
  };

  const handleClick = () => {
    if (!interactive || hoverRating === null) return;
    onChange?.(hoverRating);
  };

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
        ? '/assets/full_star.png'
        : starType === 'half'
        ? '/assets/half_star.png'
        : '/assets/zero_star.png';

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
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{ userSelect: 'none' }}
      >
        {Array.from({ length: maxStars }, (_, i) => renderStar(i))}
      </div>

      {showNumber && (
        <span className="text-xs font-medium text-amber-900 ml-1">
          {displayRating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
