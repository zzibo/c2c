'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { UsernameStep } from '@/components/onboarding/UsernameStep';
import { VibeSelection } from '@/components/onboarding/VibeSelection';
import { useAuth } from '@/lib/auth/AuthContext';
import { createProfile, updateProfile } from '@/lib/auth';
import type { VibeType } from '@/lib/supabase';

type OnboardingStep = 'username' | 'vibe';

function OnboardingContent() {
  const searchParams = useSearchParams();
  const isEditing = searchParams.get('edit') === 'true';
  const [step, setStep] = useState<OnboardingStep>(isEditing ? 'vibe' : 'username');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, profile, isOnboarded, isProfileLoading, refreshProfile } = useAuth();
  const router = useRouter();

  // Redirect if already onboarded and not editing (only after profile finishes loading)
  useEffect(() => {
    // Wait for profile to finish loading before checking onboarding status
    if (!isProfileLoading && isOnboarded) {
      // Check searchParams directly to see if we're in edit mode
      const editParam = searchParams.get('edit');
      if (editParam !== 'true') {
        router.push('/');
      }
    }
  }, [isOnboarded, isProfileLoading, router, searchParams]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/');
    }
  }, [user, router]);

  // Set username from profile if editing
  useEffect(() => {
    if (isEditing && profile) {
      setUsername(profile.username);
    }
  }, [isEditing, profile]);

  const handleUsernameNext = (selectedUsername: string) => {
    setUsername(selectedUsername);
    setStep('vibe');
  };

  // Get existing vibes from profile
  const getExistingVibes = (): VibeType[] => {
    if (!profile?.metadata) return [];
    // Check for new vibes array first, fall back to legacy single vibe
    if (profile.metadata.vibes && Array.isArray(profile.metadata.vibes)) {
      return profile.metadata.vibes;
    }
    if (profile.metadata.vibe) {
      return [profile.metadata.vibe];
    }
    return [];
  };

  const handleVibeComplete = async (vibes: VibeType[]) => {
    if (!user) return;

    setIsLoading(true);

    try {
      if (isEditing) {
        // Update existing profile
        await updateProfile(user.id, { vibes });
        await refreshProfile();
        router.push('/');
      } else {
        // Create new profile
        await createProfile(user.id, username, vibes);
        await refreshProfile();
        router.push('/');
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      alert(error.message || 'Failed to save. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return null; // Will redirect
  }

  const existingVibes = isEditing ? getExistingVibes() : [];

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col">
      {/* Header */}
      <header className="border-b-2 border-amber-900 bg-amber-100 p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-amber-900">
            {isEditing ? 'Update Your Vibes' : 'C2C Onboarding'}
          </h1>
          {!isEditing && (
            <div className="text-sm text-amber-800 font-medium">
              Step {step === 'username' ? '1' : '2'} of 2
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border-4 border-gray-900 p-12">
          {step === 'username' && <UsernameStep onNext={handleUsernameNext} />}
          {step === 'vibe' && (
            <VibeSelection
              onComplete={handleVibeComplete}
              isLoading={isLoading}
              existingVibes={existingVibes}
              isEditing={isEditing}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-amber-900 bg-amber-100 p-4">
        <div className="max-w-2xl mx-auto text-center text-sm text-amber-800">
          {isEditing ? 'Update your preferences anytime!' : "Welcome to C2C! Let's get you set up."}
        </div>
      </footer>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <div className="text-amber-900">Loading...</div>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
