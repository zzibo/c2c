'use client';

import { useState } from 'react';
import { Modal } from '@/components/auth/Modal';
import { Button } from '@/components/ui/Button';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { useAuth } from '@/lib/auth/AuthContext';
import { ProfileManagementModal } from './ProfileManagementModal';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
}

export function ProfileModal({
  isOpen,
  onClose,
  onSignOut,
}: ProfileModalProps) {
  const { profile, user } = useAuth();
  const [isManagementModalOpen, setIsManagementModalOpen] = useState(false);

  const handleSignOut = () => {
    onClose();
    onSignOut();
  };

  const handleOpenManagement = () => {
    setIsManagementModalOpen(true);
  };

  const handleCloseManagement = () => {
    setIsManagementModalOpen(false);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Profile">
        <div className="space-y-4">
          {profile && (
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <ProfileAvatar
                  photoUrl={profile.profile_photo_url}
                  username={profile.username}
                  email={user?.email}
                  size="xl"
                />
                <div>
                  <p className="text-sm text-gray-600 mb-1">Signed in as</p>
                  <p className="text-lg font-bold text-gray-900">@{profile.username}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleOpenManagement}
            >
              Manage Profile
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

      <ProfileManagementModal
        isOpen={isManagementModalOpen}
        onClose={handleCloseManagement}
      />
    </>
  );
}

