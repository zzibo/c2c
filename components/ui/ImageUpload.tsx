'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { X, Upload, Loader2 } from 'lucide-react';

interface ImageUploadProps {
  cafeId: string;
  ratingId?: string;
  existingImages?: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

export function ImageUpload({
  cafeId,
  ratingId,
  existingImages = [],
  onImagesChange,
  maxImages = 5,
  disabled = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxImages - existingImages.length;
    if (remainingSlots <= 0) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setError(null);
    setUploading(true);

    try {
      const uploadPromises = filesToUpload.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('cafeId', cafeId);
        if (ratingId) {
          formData.append('ratingId', ratingId);
        }

        const response = await fetch('/api/images/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to upload image');
        }

        const data = await response.json();
        return data.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      console.log('✅ Upload successful! URLs:', uploadedUrls);
      console.log('📸 All images after upload:', [...existingImages, ...uploadedUrls]);
      onImagesChange([...existingImages, ...uploadedUrls]);
    } catch (err) {
      console.error('❌ Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload images');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = async (imageUrl: string, index: number) => {
    if (disabled) return;

    // Extract path from URL if it's a Supabase storage URL
    // Format: https://...supabase.co/storage/v1/object/public/cafe-photos/{path}
    const urlParts = imageUrl.split('/cafe-photos/');
    const path = urlParts.length > 1 ? `cafe-photos/${urlParts[1]}` : null;

    if (path) {
      try {
        const response = await fetch(`/api/images/delete?path=${encodeURIComponent(path)}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to delete image');
        }
      } catch (err) {
        console.error('Error deleting image:', err);
        // Continue to remove from UI even if delete fails
      }
    }

    // Remove from local state
    const newImages = existingImages.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const canUploadMore = existingImages.length < maxImages && !disabled;

  return (
    <div className="space-y-2">
      {/* Existing Images */}
      {existingImages.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {existingImages.map((url, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden border-2 border-c2c-orange/40 bg-gray-100">
                <Image
                  src={url}
                  alt={`Upload ${index + 1}`}
                  width={150}
                  height={150}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveImage(url, index)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  aria-label="Remove image"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {canUploadMore && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            multiple
            onChange={handleFileSelect}
            disabled={uploading || disabled}
            className="hidden"
            id={`image-upload-${cafeId}-${ratingId || 'cafe'}`}
          />
          <label
            htmlFor={`image-upload-${cafeId}-${ratingId || 'cafe'}`}
            className={`
              flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed
              cursor-pointer transition-colors
              ${uploading || disabled
                ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                : 'border-c2c-orange bg-c2c-base hover:bg-c2c-orange/10'
              }
            `}
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin text-c2c-orange" />
                <span className="text-sm text-c2c-orange">Uploading...</span>
              </>
            ) : (
              <>
                <Upload size={16} className="text-c2c-orange" />
                <span className="text-sm text-c2c-orange">
                  Add photos ({existingImages.length}/{maxImages})
                </span>
              </>
            )}
          </label>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
          {error}
        </p>
      )}

      {/* Info */}
      {canUploadMore && (
        <p className="text-xs text-gray-500">
          JPEG, PNG, or WebP. Max 5MB per image.
        </p>
      )}
    </div>
  );
}
