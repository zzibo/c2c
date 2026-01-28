'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { uploadAndSetProfilePhoto, removeProfilePhoto, validateProfilePhoto } from '@/lib/storage/profilePhotos';
import { useAuth } from '@/lib/auth/AuthContext';

interface ProfilePhotoUploadProps {
  currentPhotoUrl: string | null;
  onPhotoUpdated?: () => void;
}

export function ProfilePhotoUpload({ currentPhotoUrl, onPhotoUpdated }: ProfilePhotoUploadProps) {
  const { user, refreshProfile } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setError(null);

    // Validate file
    const validationError = validateProfilePhoto(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Show preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Upload
    setIsUploading(true);
    try {
      const result = await uploadAndSetProfilePhoto(user.id, file);

      if (!result.success) {
        setError(result.error || 'Failed to upload photo');
        setPreviewUrl(currentPhotoUrl); // Revert preview
        return;
      }

      // Success - refresh profile to get new URL
      await refreshProfile();
      setPreviewUrl(result.url || null);

      if (onPhotoUpdated) {
        onPhotoUpdated();
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload photo');
      setPreviewUrl(currentPhotoUrl); // Revert preview
    } finally {
      setIsUploading(false);
      // Clean up object URL
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleRemovePhoto = async () => {
    if (!user) return;

    setError(null);
    setIsRemoving(true);

    try {
      const success = await removeProfilePhoto(user.id, currentPhotoUrl);

      if (!success) {
        setError('Failed to remove photo');
        return;
      }

      // Success
      await refreshProfile();
      setPreviewUrl(null);

      if (onPhotoUpdated) {
        onPhotoUpdated();
      }
    } catch (err: any) {
      console.error('Remove error:', err);
      setError(err.message || 'Failed to remove photo');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6">
        {/* Photo Preview */}
        <div className="relative">
          <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 border-4 border-gray-300">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt="Profile photo"
                width={128}
                height={128}
                className="object-cover w-full h-full"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 text-4xl font-bold">
                {user?.email?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
          </div>

          {/* Loading overlay */}
          {(isUploading || isRemoving) && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
              <div className="text-white text-sm font-medium">
                {isUploading ? 'Uploading...' : 'Removing...'}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex-1 space-y-3">
          <div className="space-y-2">
            <Button
              variant="primary"
              onClick={handleChooseFile}
              disabled={isUploading || isRemoving}
              className="w-full sm:w-auto"
            >
              {previewUrl ? 'Change Photo' : 'Upload Photo'}
            </Button>

            {previewUrl && (
              <Button
                variant="secondary"
                onClick={handleRemovePhoto}
                disabled={isUploading || isRemoving}
                className="w-full sm:w-auto"
              >
                Remove Photo
              </Button>
            )}
          </div>

          <p className="text-xs text-gray-500">
            JPEG, PNG, or WebP. Max 5MB. Recommended: square image, at least 400x400px.
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border-2 border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
