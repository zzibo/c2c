import React from 'react';
import type { VibeType } from '@/lib/supabase';

interface VibeCardProps {
  vibe: VibeType;
  icon: string;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

export function VibeCard({
  vibe,
  icon,
  title,
  description,
  selected,
  onClick,
}: VibeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full p-6 transition-all rounded-lg
        border-2 hover:shadow-lg
        ${
          selected
            ? 'bg-amber-700 border-amber-900 shadow-md transform scale-105'
            : 'bg-amber-50 border-amber-300 hover:bg-amber-100'
        }
      `}
    >
      <div className="flex flex-col items-center text-center gap-3">
        <div className="text-5xl">{icon}</div>
        <h3
          className={`text-base font-bold ${
            selected ? 'text-white' : 'text-amber-900'
          }`}
        >
          {title}
        </h3>
        <p
          className={`text-sm ${
            selected ? 'text-amber-100' : 'text-amber-700'
          }`}
        >
          {description}
        </p>
      </div>
    </button>
  );
}
