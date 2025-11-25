'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { validateUsername, checkUsernameAvailability } from '@/lib/auth';

interface UsernameStepProps {
  onNext: (username: string) => void;
}

export function UsernameStep({ onNext }: UsernameStepProps) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    const checkAvailability = async () => {
      // Validate format first
      const validationError = validateUsername(username);
      if (validationError) {
        setError(validationError);
        setIsAvailable(false);
        return;
      }

      // Check availability
      setIsChecking(true);
      setError(null);

      try {
        const available = await checkUsernameAvailability(username);
        setIsAvailable(available);
        if (!available) {
          setError('Username is already taken');
        }
      } catch (err) {
        console.error('Error checking username:', err);
        setError('Failed to check availability');
        setIsAvailable(false);
      } finally {
        setIsChecking(false);
      }
    };

    // Debounce the check
    const timer = setTimeout(() => {
      if (username) {
        checkAvailability();
      } else {
        setError(null);
        setIsAvailable(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAvailable && !isChecking && !error) {
      onNext(username);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-amber-900 mb-3">
          Choose Your Username
        </h2>
        <p className="text-sm text-amber-700">
          This is how others will see you
        </p>
      </div>

      <Input
        type="text"
        label="Username"
        placeholder="coffee_lover_42"
        value={username}
        onChange={(e) => setUsername(e.target.value.toLowerCase())}
        error={error || undefined}
        success={isAvailable && !isChecking}
        disabled={isChecking}
        autoFocus
        required
      />

      {isAvailable && !isChecking && (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded border border-green-300">
          <span className="text-sm font-medium">✓ Available!</span>
        </div>
      )}

      {isChecking && (
        <div className="text-xs text-amber-600">
          Checking availability...
        </div>
      )}

      <div className="text-xs text-amber-700 space-y-1 bg-amber-50 p-3 rounded border border-amber-300">
        <p>• 3-30 characters</p>
        <p>• Letters, numbers, and underscores only</p>
        <p>• You can change this anytime</p>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={!isAvailable || isChecking || !!error}
      >
        Next →
      </Button>
    </form>
  );
}
