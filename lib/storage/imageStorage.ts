import { supabase } from '@/lib/supabase-client';

export interface UploadImageOptions {
  file: File;
  cafeId: string;
  ratingId?: string; // Optional: if uploading for a specific rating
  folder?: 'cafe' | 'rating'; // Default: 'rating' if ratingId provided, 'cafe' otherwise
}

export interface UploadImageResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

/**
 * Upload an image to Supabase Storage
 * 
 * @param options - Upload options including file, cafeId, and optional ratingId
 * @returns Result with success status, public URL, and any error
 */
export async function uploadImage({
  file,
  cafeId,
  ratingId,
  folder,
}: UploadImageOptions): Promise<UploadImageResult> {
  try {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.',
      };
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File size too large. Maximum size is 5MB.',
      };
    }

    // Determine folder structure
    // Format: cafe-photos/{cafe_id}/{rating_id or 'cafe'}/{filename}
    const folderType = folder || (ratingId ? 'rating' : 'cafe');
    const folderPath = ratingId 
      ? `${cafeId}/${ratingId}`
      : `${cafeId}/${folderType}`;

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
    const filePath = `${folderPath}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('cafe-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      console.error('Error uploading image:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload image',
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('cafe-photos')
      .getPublicUrl(filePath);

    return {
      success: true,
      url: urlData.publicUrl,
      path: filePath,
    };
  } catch (error) {
    console.error('Unexpected error uploading image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Delete an image from Supabase Storage
 * 
 * @param path - Storage path of the image to delete
 * @returns Success status and any error
 */
export async function deleteImage(path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from('cafe-photos')
      .remove([path]);

    if (error) {
      console.error('Error deleting image:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete image',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error deleting image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get public URL for an image stored in Supabase Storage
 * 
 * @param path - Storage path of the image
 * @returns Public URL
 */
export function getImageUrl(path: string): string {
  const { data } = supabase.storage
    .from('cafe-photos')
    .getPublicUrl(path);
  
  return data.publicUrl;
}
