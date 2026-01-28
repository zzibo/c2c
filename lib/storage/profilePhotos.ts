/**
 * Profile Photo Storage Utilities
 * Handles uploading, updating, and deleting profile photos in Supabase Storage
 */

import { supabase } from '../supabase-client';

const BUCKET_NAME = 'profile-photos';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface UploadProfilePhotoResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Validates an image file for profile photo upload
 */
export function validateProfilePhoto(file: File): string | null {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
  }

  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, and WebP images are allowed';
  }

  return null;
}

/**
 * Compresses and resizes an image file
 * Returns a new File object with compressed data
 */
export async function compressImage(file: File, maxWidth = 400, maxHeight = 400, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // Calculate new dimensions (maintain aspect ratio)
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }

          // Create new file with compressed blob
          const compressedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        file.type,
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Uploads a profile photo to Supabase Storage
 * @param userId - User ID (used as folder name)
 * @param file - Image file to upload
 * @param compress - Whether to compress the image before upload (default: true)
 * @returns Upload result with public URL
 */
export async function uploadProfilePhoto(
  userId: string,
  file: File,
  compress = true
): Promise<UploadProfilePhotoResult> {
  try {
    // Validate file
    const validationError = validateProfilePhoto(file);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Compress image if requested
    const fileToUpload = compress ? await compressImage(file) : file;

    // Generate unique filename with timestamp
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return {
      success: true,
      url: urlData.publicUrl,
    };
  } catch (error: any) {
    console.error('Error uploading profile photo:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload profile photo',
    };
  }
}

/**
 * Deletes a profile photo from Supabase Storage
 * @param photoUrl - Full public URL of the photo to delete
 */
export async function deleteProfilePhoto(photoUrl: string): Promise<boolean> {
  try {
    // Extract file path from URL
    // URL format: https://{project}.supabase.co/storage/v1/object/public/profile-photos/{path}
    const pathMatch = photoUrl.match(/profile-photos\/(.+)$/);

    if (!pathMatch || !pathMatch[1]) {
      console.error('Invalid photo URL format');
      return false;
    }

    const filePath = pathMatch[1];

    // Delete from storage
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting profile photo:', error);
    return false;
  }
}

/**
 * Updates user's profile photo URL in the database
 * @param userId - User ID
 * @param photoUrl - New photo URL (or null to remove)
 */
export async function updateProfilePhotoInDatabase(
  userId: string,
  photoUrl: string | null
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ profile_photo_url: photoUrl })
      .eq('id', userId);

    if (error) {
      console.error('Database update error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating profile photo in database:', error);
    return false;
  }
}

/**
 * Complete flow: Upload new photo and update profile
 * Handles deleting old photo automatically via database trigger
 */
export async function uploadAndSetProfilePhoto(
  userId: string,
  file: File
): Promise<UploadProfilePhotoResult> {
  // Upload new photo
  const uploadResult = await uploadProfilePhoto(userId, file);

  if (!uploadResult.success || !uploadResult.url) {
    return uploadResult;
  }

  // Update database (trigger will handle deleting old photo)
  const dbSuccess = await updateProfilePhotoInDatabase(userId, uploadResult.url);

  if (!dbSuccess) {
    // Rollback: delete the newly uploaded photo
    await deleteProfilePhoto(uploadResult.url);
    return {
      success: false,
      error: 'Failed to update profile. Please try again.',
    };
  }

  return {
    success: true,
    url: uploadResult.url,
  };
}

/**
 * Remove profile photo completely
 */
export async function removeProfilePhoto(
  userId: string,
  currentPhotoUrl: string | null
): Promise<boolean> {
  try {
    // Update database to null (trigger will handle deletion)
    const dbSuccess = await updateProfilePhotoInDatabase(userId, null);

    if (!dbSuccess) {
      return false;
    }

    // Manual fallback deletion if trigger didn't work
    if (currentPhotoUrl) {
      await deleteProfilePhoto(currentPhotoUrl);
    }

    return true;
  } catch (error) {
    console.error('Error removing profile photo:', error);
    return false;
  }
}
