'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/auth/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { VibeSelection } from '@/components/onboarding/VibeSelection';
import { useAuth } from '@/lib/auth/AuthContext';
import { updateProfile, checkUsernameAvailability, validateUsername } from '@/lib/auth';
import { useUpdateVibes } from '@/hooks/useUpdateVibes';
import type { VibeType } from '@/lib/supabase';

interface ProfileManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'edit' | 'submissions';

interface UserSubmission {
  id: string;
  name: string;
  google_maps_link: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  latitude: number | null;
  longitude: number | null;
}

export function ProfileManagementModal({
  isOpen,
  onClose,
}: ProfileManagementModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const updateVibesMutation = useUpdateVibes();
  const [activeTab, setActiveTab] = useState<TabType>('edit');
  
  // Edit profile state
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [selectedVibes, setSelectedVibes] = useState<VibeType[]>([]);
  
  // Submissions state
  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);

  // Initialize form with profile data and sync when profile updates
  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      // Only update selectedVibes if not currently saving (to avoid overwriting optimistic update)
      if (!updateVibesMutation.isPending) {
        const profileVibes = profile.metadata?.vibes || 
          (profile.metadata?.vibe ? [profile.metadata.vibe as VibeType] : []);
        setSelectedVibes(profileVibes);
      }
    }
  }, [profile, updateVibesMutation.isPending]);

  // Fetch submissions when tab is active
  useEffect(() => {
    if (isOpen && activeTab === 'submissions' && user) {
      fetchSubmissions();
    }
  }, [isOpen, activeTab, user]);

  const fetchSubmissions = async () => {
    setIsLoadingSubmissions(true);
    try {
      const response = await fetch('/api/cafes/user-submitted');
      if (!response.ok) throw new Error('Failed to fetch submissions');
      const data = await response.json();
      setSubmissions(data.submissions || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  const handleUsernameChange = async (value: string) => {
    setUsername(value);
    setUsernameError(null);

    // Validate format
    const validationError = validateUsername(value);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }

    // Check availability if username changed
    if (value !== profile?.username) {
      try {
        const isAvailable = await checkUsernameAvailability(value);
        if (!isAvailable) {
          setUsernameError('Username is already taken');
        }
      } catch (error) {
        console.error('Error checking username:', error);
      }
    }
  };

  const handleSaveUsername = async () => {
    if (!user || !username || usernameError) return;

    setIsSavingProfile(true);
    try {
      await updateProfile(user.id, { username });
      await refreshProfile();
      setUsernameError(null);
    } catch (error: any) {
      console.error('Error updating username:', error);
      setUsernameError(error.message || 'Failed to update username');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveVibes = async (vibes: VibeType[]) => {
    if (!user) return;

    // Optimistically update local state immediately for instant UI feedback
    setSelectedVibes(vibes);

    // Use TanStack Query mutation with optimistic updates
    updateVibesMutation.mutate(vibes, {
      onSuccess: () => {
        // Success - profile refreshed by mutation hook
        // selectedVibes already updated optimistically
      },
      onError: (error) => {
        // Error - rollback to previous vibes from profile
        const previousVibes = profile?.metadata?.vibes || 
          (profile?.metadata?.vibe ? [profile.metadata.vibe as VibeType] : []);
        setSelectedVibes(previousVibes);
        console.error('Error updating vibes:', error);
      },
    });
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300',
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded border ${
          styles[status as keyof typeof styles] || styles.pending
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profile Management" size="xl">
      <div className="w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Tabs */}
        <div className="flex border-b-2 border-gray-300 mb-4">
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'edit'
                ? 'text-c2c-orange border-b-2 border-c2c-orange'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Edit Profile
          </button>
          <button
            onClick={() => setActiveTab('submissions')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'submissions'
                ? 'text-c2c-orange border-b-2 border-c2c-orange'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            My Submissions
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'edit' && (
            <div className="space-y-8">
              {/* Username Section */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Username</h3>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      label="Username"
                      value={username}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      error={usernameError || undefined}
                      placeholder="Enter your username"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="primary"
                      onClick={handleSaveUsername}
                      disabled={!username || !!usernameError || username === profile?.username || isSavingProfile}
                    >
                      {isSavingProfile ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Vibes Section */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Vibes</h3>
                <VibeSelection
                  existingVibes={selectedVibes}
                  isEditing={true}
                  isLoading={updateVibesMutation.isPending}
                  onComplete={handleSaveVibes}
                />
              </div>
            </div>
          )}

          {activeTab === 'submissions' && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Your Cafe Submissions</h3>
              {isLoadingSubmissions ? (
                <div className="text-center py-8 text-gray-600">Loading submissions...</div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
                  <p>You haven't submitted any cafes yet.</p>
                  <p className="text-sm text-gray-500 mt-2">Submit cafes from the map to see them here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="border-2 border-gray-300 rounded-lg p-4 bg-c2c-base"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-lg font-bold text-gray-900">{submission.name}</h4>
                        {getStatusBadge(submission.status)}
                      </div>
                      <div className="space-y-2 text-sm text-gray-700">
                        <p>
                          <span className="font-medium">Submitted:</span>{' '}
                          {new Date(submission.created_at).toLocaleDateString()}
                        </p>
                        {submission.google_maps_link && (
                          <p>
                            <span className="font-medium">Google Maps:</span>{' '}
                            <a
                              href={submission.google_maps_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-c2c-orange hover:underline"
                            >
                              View on Google Maps
                            </a>
                          </p>
                        )}
                        {submission.latitude && submission.longitude && (
                          <p>
                            <span className="font-medium">Location:</span>{' '}
                            {submission.latitude.toFixed(6)}, {submission.longitude.toFixed(6)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
