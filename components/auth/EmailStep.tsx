'use client';

import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { signInWithEmail, signInWithGoogle } from '@/lib/auth';

interface EmailStepProps {
  onSuccess: (email: string) => void;
}

export function EmailStep({ onSuccess }: EmailStepProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      await signInWithEmail(email);
      onSuccess(email);
    } catch (err: unknown) {
      console.error('Error sending OTP:', err);
      const message = err instanceof Error ? err.message : 'Failed to send code. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);

    try {
      await signInWithGoogle();
      // Google OAuth redirects, so no need to handle success here
    } catch (err: unknown) {
      console.error('Error signing in with Google:', err);
      const message = err instanceof Error ? err.message : 'Failed to sign in with Google. Please try again.';
      setError(message);
      setIsGoogleLoading(false);
    }
  };

  const isDisabled = isLoading || isGoogleLoading;

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Sign In
        </h3>
        <p className="text-sm text-gray-700">
          Choose your sign in method
        </p>
      </div>

      {/* Google Sign In Button */}
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full flex items-center justify-center gap-3"
        onClick={handleGoogleSignIn}
        disabled={isDisabled}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {isGoogleLoading ? 'Signing in...' : 'Continue with Google'}
      </Button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">or</span>
        </div>
      </div>

      {/* Email Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          label="Email Address"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error || undefined}
          disabled={isDisabled}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={isDisabled}
        >
          {isLoading ? 'Sending...' : 'Send Code'}
        </Button>
      </form>

      <p className="text-xs text-gray-700 text-center bg-c2c-base p-2 rounded border border-gray-300">
        No password needed. We'll email you a one-time code.
      </p>
    </div>
  );
}
