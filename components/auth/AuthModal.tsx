'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { EmailStep } from './EmailStep';
import { OTPStep } from './OTPStep';
import { useAuth } from '@/lib/auth/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'email' | 'otp' | 'loading';

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const { isProfileLoading } = useAuth();

  const handleEmailSuccess = (submittedEmail: string) => {
    setEmail(submittedEmail);
    setStep('otp');
  };

  const handleOTPSuccess = () => {
    // Switch to loading step - profile will be automatically fetched by AuthContext.handleSessionChange
    setStep('loading');
  };

  // Watch for profile loading completion and close modal
  useEffect(() => {
    if (step === 'loading' && !isProfileLoading) {
      // Profile has finished loading, close modal
      onClose();
      // Reset state after a brief delay
      setTimeout(() => {
        setStep('email');
        setEmail('');
      }, 300);
    }
  }, [step, isProfileLoading, onClose]);

  const handleBack = () => {
    setStep('email');
  };

  const handleClose = () => {
    // Don't allow closing during loading
    if (step === 'loading') {
      return;
    }
    onClose();
    // Reset state after animation
    setTimeout(() => {
      setStep('email');
      setEmail('');
    }, 300);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Sign In to C2C">
      {step === 'email' && <EmailStep onSuccess={handleEmailSuccess} />}
      {step === 'otp' && (
        <OTPStep email={email} onSuccess={handleOTPSuccess} onBack={handleBack} />
      )}
      {step === 'loading' && (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-c2c-orange mb-4"></div>
          <p className="text-gray-700 text-sm">Signing you in...</p>
          <p className="text-gray-500 text-xs mt-2">Loading your profile</p>
        </div>
      )}
    </Modal>
  );
}
