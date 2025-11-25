-- ============================================================================
-- MIGRATION 004: User Profiles & Authentication
-- Created: 2025-11-12
-- Purpose: Add user profiles with onboarding and vibe preferences
-- ============================================================================

-- 1. CREATE PROFILES TABLE
-- ============================================================================
CREATE TABLE profiles (
  -- Primary Key (linked to auth.users)
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- User Identity
  username TEXT UNIQUE NOT NULL,

  -- Onboarding Status
  is_onboarded BOOLEAN DEFAULT false NOT NULL,

  -- Flexible Metadata (JSONB)
  metadata JSONB DEFAULT '{}' NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT username_length CHECK (
    char_length(username) >= 3 AND
    char_length(username) <= 30
  ),
  CONSTRAINT username_format CHECK (
    username ~ '^[a-zA-Z0-9_]+$'
  )
);

-- 2. CREATE INDEXES
-- ============================================================================
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_is_onboarded ON profiles(is_onboarded);
CREATE INDEX idx_profiles_metadata_vibe ON profiles USING GIN((metadata->'vibe'));
CREATE INDEX idx_profiles_created_at ON profiles(created_at DESC);

-- 3. CREATE TRIGGERS
-- ============================================================================
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. CREATE RLS POLICIES
-- ============================================================================

-- Public read access for profiles (everyone can view)
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Authenticated users can create their own profile
CREATE POLICY "Users can create their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can delete their own profile
CREATE POLICY "Users can delete their own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- 6. GRANT PERMISSIONS
-- ============================================================================
GRANT SELECT ON profiles TO anon;
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON profiles TO service_role;

-- 7. CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function: Get user profile with stats
CREATE OR REPLACE FUNCTION get_user_profile_with_stats(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  vibe TEXT,
  is_onboarded BOOLEAN,
  total_ratings BIGINT,
  avg_rating NUMERIC,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.metadata->>'vibe' as vibe,
    p.is_onboarded,
    COUNT(r.id) as total_ratings,
    AVG(r.overall_rating) as avg_rating,
    p.created_at
  FROM profiles p
  LEFT JOIN ratings r ON p.id = r.user_id
  WHERE p.id = user_uuid
  GROUP BY p.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check username availability
CREATE OR REPLACE FUNCTION is_username_available(check_username TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM profiles WHERE username = check_username
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
