'use client';

import React from 'react';
import { Modal } from '@/components/auth/Modal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/AuthContext';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChangeVibe: () => void;
  onSignOut: () => void;
}

export function ProfileModal({
  isOpen,
  onClose,
  onChangeVibe,
  onSignOut,
}: ProfileModalProps) {
  const { profile } = useAuth();

  const handleChangeVibe = (e: React.MouseEvent) => {
    e.preventDefault();
    onChangeVibe();
  };

  const handleSignOut = () => {
    onClose();
    onSignOut();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profile">
      <div className="space-y-4">
        {profile && (
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-1">Signed in as</p>
            <p className="text-lg font-bold text-gray-900">@{profile.username}</p>
          </div>
        )}

        <div className="space-y-3">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleChangeVibe}
          >
            Change Vibes
          </Button>

          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={handleSignOut}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </Modal>
  );
}

