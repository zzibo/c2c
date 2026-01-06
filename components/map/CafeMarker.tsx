'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Marker } from 'react-map-gl/mapbox';
import { MapPin } from 'lucide-react';
import type { Cafe } from '@/types/cafe';

interface CafeMarkerProps {
  cafe: Cafe;
  isSelected: boolean;
  zoom: number;
  onClick: (cafe: Cafe, e: React.MouseEvent) => void;
}

export function CafeMarker({ cafe, isSelected, zoom, onClick }: CafeMarkerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const markerRef = useRef<HTMLDivElement>(null);

  // Calculate pin size based on zoom level (base size 50, scales with zoom)
  const baseSize = 50;
  const zoomScale = Math.max(0.8, Math.min(1.5, zoom / 13)); // Scale between 0.8x and 1.5x based on zoom
  const pinSize = baseSize * zoomScale;
  const iconSize = Math.round(24 * zoomScale);
  const iconTop = Math.round(8 * zoomScale);

  // Update tooltip position continuously while hovered (handles map movement/zoom)
  useEffect(() => {
    if (!isHovered || !markerRef.current) return;

    const updatePosition = () => {
      if (markerRef.current) {
        const rect = markerRef.current.getBoundingClientRect();
        setTooltipPosition({
          top: rect.top - 10, // Position above the marker
          left: rect.left + rect.width / 2, // Center horizontally
        });
      }
    };

    // Update immediately
    updatePosition();

    // Update on scroll/zoom/move
    const interval = setInterval(updatePosition, 100);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      clearInterval(interval);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isHovered]);

  return (
    <>
      <Marker
        longitude={cafe.location.lng}
        latitude={cafe.location.lat}
        anchor="bottom"
        style={{ zIndex: isSelected ? 1000 : 1 }}
      >
        <div 
          ref={markerRef}
          className="relative group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div
            className={`relative cursor-pointer ${isSelected ? 'z-[1000]' : ''}`}
            onClick={(e) => onClick(cafe, e)}
          >
            {/* Pin shape with coffee icon inside */}
            <div className={`transform transition-transform hover:scale-110 relative ${isSelected ? 'scale-110' : ''}`}>
              {/* Map pin icon */}
              <MapPin
                size={pinSize}
                className={`drop-shadow-lg ${isSelected ? 'text-pixel-beige' : 'text-blue-500'}`}
                fill={isSelected ? '#f5e6d3' : 'white'}
                stroke={isSelected ? '#f5e6d3' : 'white'}
              />
              {/* Coffee icon inside the pin - centered in the circular part */}
              <div
                className="absolute left-1/2 transform -translate-x-1/2 flex items-center justify-center"
                style={{
                  top: `${iconTop}px`,
                  width: `${iconSize}px`,
                  height: `${iconSize}px`,
                  backgroundColor: isSelected ? '#f5e6d3' : 'transparent',
                  borderRadius: 0
                }}
              >
                <Image
                  src="/assets/cafe-icon.webp"
                  alt="Cafe"
                  width={iconSize}
                  height={iconSize}
                  className="object-contain pixel-image"
                  unoptimized
                  priority={isSelected}
                  fetchPriority={isSelected ? "high" : "auto"}
                />
              </div>
            </div>
          </div>
        </div>
      </Marker>

      {/* Tooltip rendered via Portal - outside Marker's DOM hierarchy */}
      {isHovered && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed pointer-events-none z-[10000] transition-opacity"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: 'translate(-50%, -100%)',
            marginBottom: '8px',
          }}
        >
          <div className="bg-c2c-orange border-2 border-c2c-orange-dark px-3 py-2 shadow-lg whitespace-nowrap rounded-lg">
            <p className="text-xs font-bold text-white font-sans">{cafe.name}</p>
            <p className="text-xs text-white/90 font-sans">
              {cafe.ratings.overall > 0 ? `${cafe.ratings.overall.toFixed(1)} ★` : 'No ratings yet'}
            </p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

