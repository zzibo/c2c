'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { VibeCard } from './VibeCard';
import type { VibeType } from '@/lib/supabase';

interface VibeSelectionProps {
  onComplete: (vibes: VibeType[]) => void;
  isLoading?: boolean;
  existingVibes?: VibeType[];
  isEditing?: boolean;
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

export function VibeSelection({ onComplete, isLoading, existingVibes = [], isEditing = false }: VibeSelectionProps) {
  const [selectedVibes, setSelectedVibes] = useState<VibeType[]>(existingVibes);

  // Update selected vibes when existingVibes changes
  useEffect(() => {
    setSelectedVibes(existingVibes);
  }, [existingVibes]);

  const handleVibeToggle = (vibe: VibeType) => {
    setSelectedVibes((prev) => {
      if (prev.includes(vibe)) {
        return prev.filter((v) => v !== vibe);
      } else {
        return [...prev, vibe];
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedVibes.length > 0) {
      onComplete(selectedVibes);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-amber-900 mb-3">
          {isEditing ? 'Update Your Vibes' : 'Choose Your Vibes'}
        </h2>
        <p className="text-sm text-amber-700">
          {isEditing 
            ? 'Select all the vibes that bring you to cafes. You can choose multiple!'
            : 'What brings you to cafes? You can choose multiple!'}
        </p>
        {existingVibes.length > 0 && (
          <p className="text-xs text-amber-600 mt-2">
            Current vibes: {existingVibes.map(v => VIBES.find(vb => vb.vibe === v)?.title).join(', ')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {VIBES.map(({ vibe, title, description }) => (
          <VibeCard
            key={vibe}
            vibe={vibe}
            title={title}
            description={description}
            selected={selectedVibes.includes(vibe)}
            onClick={() => handleVibeToggle(vibe)}
          />
        ))}
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={selectedVibes.length === 0 || isLoading}
      >
        {isLoading 
          ? (isEditing ? 'Updating...' : 'Completing...') 
          : (isEditing ? 'Update Vibes →' : 'Complete Onboarding →')}
      </Button>
    </form>
  );
}
