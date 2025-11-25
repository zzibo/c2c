'use client';

import React, { useState } from 'react';
import { Modal } from './Modal';
import { EmailStep } from './EmailStep';
import { OTPStep } from './OTPStep';
import { useAuth } from '@/lib/auth/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'email' | 'otp';

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const { refreshProfile } = useAuth();

  const handleEmailSuccess = (submittedEmail: string) => {
    setEmail(submittedEmail);
    setStep('otp');
  };

  const handleOTPSuccess = async () => {
    // Refresh profile to get latest data
    await refreshProfile();
    // Close modal
    onClose();
    // Reset state
    setStep('email');
    setEmail('');
  };

  const handleBack = () => {
    setStep('email');
  };

  const handleClose = () => {
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
    </Modal>
  );
}
