'use client';

import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { VibeCard } from './VibeCard';
import type { VibeType } from '@/lib/supabase';

interface VibeSelectionProps {
  onComplete: (vibe: VibeType) => void;
  isLoading?: boolean;
}

const VIBES: Array<{
  vibe: VibeType;
  title: string;
  description: string;
}> = [
  {
    vibe: 'lock-in',
    title: 'Lock In',
    description: 'Deep work',
  },
  {
    vibe: 'network',
    title: 'Network',
    description: 'Meeting people',
  },
  {
    vibe: 'chill',
    title: 'Chill',
    description: 'Relaxed vibes',
  },
];

export function VibeSelection({ onComplete, isLoading }: VibeSelectionProps) {
  const [selectedVibe, setSelectedVibe] = useState<VibeType | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedVibe) {
      onComplete(selectedVibe);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-amber-900 mb-3">
          Choose Your Vibe
        </h2>
        <p className="text-sm text-amber-700">
          What brings you to cafes?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {VIBES.map(({ vibe, title, description }) => (
          <VibeCard
            key={vibe}
            vibe={vibe}
            title={title}
            description={description}
            selected={selectedVibe === vibe}
            onClick={() => setSelectedVibe(vibe)}
          />
        ))}
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={!selectedVibe || isLoading}
      >
        {isLoading ? 'Completing...' : 'Complete Onboarding →'}
      </Button>
    </form>
  );
}
