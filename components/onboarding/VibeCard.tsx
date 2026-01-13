import React from 'react';
import Image from 'next/image';
import type { VibeType } from '@/lib/supabase';

interface VibeCardProps {
  vibe: VibeType;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

// Map vibe types to their webp images
const VIBE_IMAGES: Record<VibeType, string> = {
  'lock-in': '/assets/grind.webp',
  'network': '/assets/network.webp',
  'chill': '/assets/chill.webp',
};

export function VibeCard({
  vibe,
  title,
  description,
  selected,
  onClick,
}: VibeCardProps) {
  const imageSrc = VIBE_IMAGES[vibe];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full p-10 transition-all rounded-2xl
        border-4 hover:shadow-xl
        ${
          selected
            ? 'bg-c2c-orange border-c2c-orange-dark shadow-md transform scale-105'
            : 'bg-white border-gray-300 hover:bg-gray-50'
        }
      `}
    >
      <div className="flex flex-col items-center text-center gap-6">
        <div className="relative">
          <Image
            src={imageSrc}
            alt={title}
            width={160}
            height={160}
            className="object-contain"
          />
        </div>
        <h3
          className={`text-2xl font-bold ${
            selected ? 'text-white' : 'text-gray-900'
          }`}
        >
          {title}
        </h3>
        <p
          className={`text-sm ${
            selected ? 'text-white' : 'text-gray-700'
          }`}
        >
          {description}
        </p>
      </div>
    </button>
  );
}
