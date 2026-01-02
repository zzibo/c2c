'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { signInWithEmail, verifyOTP } from '@/lib/auth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset modal state
  const resetModal = () => {
    setStep('email');
    setEmail('');
    setOtp('');
    setError(null);
    setLoading(false);
  };

  // Handle close
  const handleClose = () => {
    resetModal();
    onClose();
  };

  // Step 1: Send OTP to email
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmail(email);
      setStep('otp');
      setError(null);
    } catch (err) {
      console.error('Error sending OTP:', err);
      setError('Failed to send code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP code
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { session, user } = await verifyOTP(email, otp);

      if (!session || !user) {
        throw new Error('Invalid verification code');
      }

      // Success!
      resetModal();
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setError('Invalid code. Please check and try again.');
      setOtp(''); // Clear OTP input
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP input change (auto-format to 6 digits)
  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setError(null);
    setLoading(true);

    try {
      await signInWithEmail(email);
      setError(null);
      // Show success message briefly
      setError('Code resent! Check your email.');
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      console.error('Error resending OTP:', err);
      setError('Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-amber-50 border-2 border-amber-900 shadow-xl z-50 w-full max-w-md p-6">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 hover:bg-amber-200 rounded transition-colors"
          aria-label="Close"
        >
          <X size={20} className="text-amber-900" />
        </button>

        {/* Step 1: Email Input */}
        {step === 'email' && (
          <>
            <h2 className="text-xl font-bold text-amber-900 mb-2">Sign In</h2>
            <p className="text-sm text-amber-700 mb-4">
              Enter your email to receive a verification code
            </p>

            <form onSubmit={handleSendOTP}>
              <div className="mb-4">
                <label className="block text-sm text-amber-800 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  disabled={loading}
                  className="w-full px-3 py-2 text-sm bg-white border border-amber-700 rounded focus:outline-none focus:ring-2 focus:ring-amber-600 text-amber-900 placeholder-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {error && (
                <div className="mb-4 bg-red-100 text-red-800 px-3 py-2 rounded text-sm border border-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition-all text-sm font-medium"
              >
                {loading ? 'Sending Code...' : 'Send Verification Code'}
              </button>
            </form>
          </>
        )}

        {/* Step 2: OTP Input */}
        {step === 'otp' && (
          <>
            <h2 className="text-xl font-bold text-amber-900 mb-2">Enter Code</h2>
            <p className="text-sm text-amber-700 mb-4">
              We sent a 6-digit code to{' '}
              <span className="font-semibold">{email}</span>
            </p>

            <form onSubmit={handleVerifyOTP}>
              <div className="mb-4">
                <label className="block text-sm text-amber-800 mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={handleOtpChange}
                  placeholder="000000"
                  required
                  disabled={loading}
                  maxLength={6}
                  className="w-full px-3 py-2 text-2xl text-center font-mono tracking-widest bg-white border border-amber-700 rounded focus:outline-none focus:ring-2 focus:ring-amber-600 text-amber-900 placeholder-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  autoFocus
                />
                <p className="text-xs text-amber-600 mt-1 text-center">
                  {otp.length}/6 digits
                </p>
              </div>

              {error && (
                <div className="mb-4 bg-red-100 text-red-800 px-3 py-2 rounded text-sm border border-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition-all text-sm font-medium mb-3"
              >
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>

              {/* Resend / Change Email */}
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="text-amber-700 hover:text-amber-900 underline disabled:opacity-50"
                >
                  Resend Code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setOtp('');
                    setError(null);
                  }}
                  className="text-amber-700 hover:text-amber-900 underline"
                >
                  Change Email
                </button>
              </div>
            </form>
          </>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-amber-300">
          <p className="text-xs text-amber-600 text-center">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </>
  );
}
