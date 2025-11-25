'use client';

import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { signInWithEmail } from '@/lib/auth';

interface EmailStepProps {
  onSuccess: (email: string) => void;
}

export function EmailStep({ onSuccess }: EmailStepProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
    } catch (err: any) {
      console.error('Error sending OTP:', err);
      setError(err.message || 'Failed to send code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-amber-900 mb-2">
          Sign In
        </h3>
        <p className="text-sm text-amber-700">
          We'll send you a magic code
        </p>
      </div>

      <Input
        type="email"
        label="Email Address"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error || undefined}
        disabled={isLoading}
        autoFocus
        required
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? 'Sending...' : 'Send Code'}
      </Button>

      <p className="text-xs text-amber-700 text-center bg-amber-50 p-2 rounded border border-amber-300">
        No password needed. We'll email you a one-time code.
      </p>
    </form>
  );
}
