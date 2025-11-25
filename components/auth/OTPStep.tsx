'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { verifyOTP, signInWithEmail } from '@/lib/auth';

interface OTPStepProps {
  email: string;
  onSuccess: () => void;
  onBack: () => void;
}

export function OTPStep({ email, onSuccess, onBack }: OTPStepProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendCountdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (code.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setIsLoading(true);

    try {
      await verifyOTP(email, code);
      onSuccess();
    } catch (err: any) {
      console.error('Error verifying OTP:', err);
      if (err.message?.includes('expired')) {
        setError('Code expired. Please request a new one.');
      } else if (err.message?.includes('invalid')) {
        setError('Invalid code. Please check and try again.');
      } else {
        setError(err.message || 'Failed to verify code. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setError(null);
    setCanResend(false);
    setResendCountdown(60);

    try {
      await signInWithEmail(email);
    } catch (err: any) {
      console.error('Error resending code:', err);
      setError('Failed to resend code. Please try again.');
      setCanResend(true);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-amber-900 mb-2">
          Check Your Email
        </h3>
        <p className="text-sm text-amber-700">
          We sent a code to
        </p>
        <p className="text-sm text-amber-900 font-semibold mt-1 bg-amber-50 px-3 py-2 rounded border border-amber-300 inline-block">
          {email}
        </p>
      </div>

      <Input
        type="text"
        label="6-Digit Code"
        placeholder="000000"
        value={code}
        onChange={(e) => {
          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
          setCode(value);
        }}
        error={error || undefined}
        disabled={isLoading}
        autoFocus
        required
        maxLength={6}
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={isLoading || code.length !== 6}
      >
        {isLoading ? 'Verifying...' : 'Verify Code'}
      </Button>

      <div className="flex justify-between items-center pt-2">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-amber-700 hover:text-amber-900 font-medium transition-colors"
        >
          ← Change Email
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={!canResend}
          className="text-sm text-amber-700 hover:text-amber-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {canResend ? 'Resend Code' : `Resend in ${resendCountdown}s`}
        </button>
      </div>
    </form>
  );
}
