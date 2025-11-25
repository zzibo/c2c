'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UsernameStep } from '@/components/onboarding/UsernameStep';
import { VibeSelection } from '@/components/onboarding/VibeSelection';
import { useAuth } from '@/lib/auth/AuthContext';
import { createProfile } from '@/lib/auth';
import type { VibeType } from '@/lib/supabase';

type OnboardingStep = 'username' | 'vibe';

export default function OnboardingPage() {
  const [step, setStep] = useState<OnboardingStep>('username');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, isOnboarded, refreshProfile } = useAuth();
  const router = useRouter();

  // Redirect if already onboarded
  useEffect(() => {
    if (isOnboarded) {
      router.push('/');
    }
  }, [isOnboarded, router]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/');
    }
  }, [user, router]);

  const handleUsernameNext = (selectedUsername: string) => {
    setUsername(selectedUsername);
    setStep('vibe');
  };

  const handleVibeComplete = async (vibe: VibeType) => {
    if (!user) return;

    setIsLoading(true);

    try {
      await createProfile(user.id, username, vibe);
      await refreshProfile();
      router.push('/');
    } catch (error: any) {
      console.error('Error creating profile:', error);
      alert(error.message || 'Failed to complete onboarding. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col">
      {/* Header */}
      <header className="border-b-2 border-amber-900 bg-amber-100 p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-amber-900">C2C Onboarding</h1>
          <div className="text-sm text-amber-800 font-medium">
            Step {step === 'username' ? '1' : '2'} of 2
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg border-2 border-amber-900 p-8">
          {step === 'username' && <UsernameStep onNext={handleUsernameNext} />}
          {step === 'vibe' && (
            <VibeSelection onComplete={handleVibeComplete} isLoading={isLoading} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-amber-900 bg-amber-100 p-4">
        <div className="max-w-2xl mx-auto text-center text-sm text-amber-800">
          Welcome to C2C! Let's get you set up.
        </div>
      </footer>
    </div>
  );
}
