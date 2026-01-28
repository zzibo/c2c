-- ============================================================================
-- MIGRATION 008: Profile Photos
-- Created: 2026-01-27
-- Purpose: Add profile photo support with Supabase Storage integration
-- ============================================================================

-- 1. ADD PROFILE_PHOTO_URL COLUMN TO PROFILES TABLE
-- ============================================================================
ALTER TABLE profiles
ADD COLUMN profile_photo_url TEXT;

-- 2. CREATE PROFILE_PHOTOS STORAGE BUCKET
-- ============================================================================
-- Note: This must be run via Supabase Dashboard or CLI, not in migration SQL
-- Bucket name: 'profile-photos'
-- Settings:
--   - Public: true (so photos can be displayed without auth)
--   - File size limit: 5MB
--   - Allowed MIME types: image/jpeg, image/png, image/webp

-- 3. CREATE STORAGE POLICIES FOR PROFILE_PHOTOS BUCKET
-- ============================================================================

-- Allow authenticated users to upload their own profile photo
-- File path pattern: {user_id}/{filename}
INSERT INTO storage.policies (name, bucket_id, command, definition)
VALUES (
  'Users can upload their own profile photo',
  'profile-photos',
  'INSERT',
  'auth.uid()::text = (storage.foldername(name))[1]'
);

-- Allow authenticated users to update their own profile photo
INSERT INTO storage.policies (name, bucket_id, command, definition)
VALUES (
  'Users can update their own profile photo',
  'profile-photos',
  'UPDATE',
  'auth.uid()::text = (storage.foldername(name))[1]'
);

-- Allow authenticated users to delete their own profile photo
INSERT INTO storage.policies (name, bucket_id, command, definition)
VALUES (
  'Users can delete their own profile photo',
  'profile-photos',
  'DELETE',
  'auth.uid()::text = (storage.foldername(name))[1]'
);

-- Allow public read access to all profile photos
INSERT INTO storage.policies (name, bucket_id, command, definition)
VALUES (
  'Public profile photos are viewable by everyone',
  'profile-photos',
  'SELECT',
  'true'
);

-- 4. CREATE HELPER FUNCTION TO DELETE OLD PROFILE PHOTO
-- ============================================================================
CREATE OR REPLACE FUNCTION delete_old_profile_photo()
RETURNS TRIGGER AS $$
BEGIN
  -- If profile_photo_url changed and old value exists, delete the old file
  IF OLD.profile_photo_url IS NOT NULL AND
     NEW.profile_photo_url IS DISTINCT FROM OLD.profile_photo_url THEN
    -- Extract file path from URL
    -- URL format: https://{project}.supabase.co/storage/v1/object/public/profile-photos/{path}
    DECLARE
      old_path TEXT;
    BEGIN
      -- Extract path after 'profile-photos/'
      old_path := substring(OLD.profile_photo_url from 'profile-photos/(.+)$');

      IF old_path IS NOT NULL THEN
        -- Delete from storage (must be called by service role)
        PERFORM storage.delete_object('profile-photos', old_path);
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. CREATE TRIGGER TO AUTO-DELETE OLD PROFILE PHOTOS
-- ============================================================================
CREATE TRIGGER cleanup_old_profile_photo
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.profile_photo_url IS DISTINCT FROM NEW.profile_photo_url)
  EXECUTE FUNCTION delete_old_profile_photo();

-- 6. CREATE TRIGGER TO DELETE PROFILE PHOTO ON ACCOUNT DELETION
-- ============================================================================
CREATE OR REPLACE FUNCTION delete_profile_photo_on_account_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.profile_photo_url IS NOT NULL THEN
    DECLARE
      old_path TEXT;
    BEGIN
      old_path := substring(OLD.profile_photo_url from 'profile-photos/(.+)$');

      IF old_path IS NOT NULL THEN
        PERFORM storage.delete_object('profile-photos', old_path);
      END IF;
    END;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER cleanup_profile_photo_on_deletion
  BEFORE DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION delete_profile_photo_on_account_deletion();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- MANUAL STEPS REQUIRED (Run via Supabase Dashboard):
-- 1. Go to Storage in Supabase Dashboard
-- 2. Create new bucket: 'profile-photos'
-- 3. Settings:
--    - Public: ON
--    - File size limit: 5242880 (5MB)
--    - Allowed MIME types: image/jpeg, image/png, image/webp
