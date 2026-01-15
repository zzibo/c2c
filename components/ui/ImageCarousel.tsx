'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageCarouselProps {
  images: string[];
  fallbackImage?: string;
  className?: string;
}

export function ImageCarousel({
  images,
  fallbackImage = '/assets/c2c-icon.webp',
  className = '',
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset to first image when images array changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [images]);

  // Use fallback if no images
  const displayImages = images.length > 0 ? images : [fallbackImage];
  const showControls = images.length > 1;

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? displayImages.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === displayImages.length - 1 ? 0 : prev + 1));
  };

  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showControls) return;

      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showControls, displayImages.length]);

  return (
    <div className={`relative ${className}`}>
      {/* Image Display */}
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <Image
          src={displayImages[currentIndex]}
          alt={images.length > 0 ? `Cafe photo ${currentIndex + 1}` : 'C2C Logo'}
          width={120}
          height={120}
          className="object-contain pixel-image max-h-full"
          unoptimized
          priority
        />
      </div>

      {/* Navigation Arrows */}
      {showControls && (
        <>
          <button
            onClick={handlePrevious}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1 bg-white/80 hover:bg-white rounded-full transition-colors shadow-md"
            aria-label="Previous image"
          >
            <ChevronLeft size={20} className="text-c2c-orange" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-white/80 hover:bg-white rounded-full transition-colors shadow-md"
            aria-label="Next image"
          >
            <ChevronRight size={20} className="text-c2c-orange" />
          </button>
        </>
      )}

      {/* Dot Indicators */}
      {showControls && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {displayImages.map((_, index) => (
            <button
              key={index}
              onClick={() => handleDotClick(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-c2c-orange w-4'
                  : 'bg-gray-400 hover:bg-gray-500'
              }`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Image Counter */}
      {showControls && (
        <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded">
          {currentIndex + 1} / {displayImages.length}
        </div>
      )}
    </div>
  );
}
