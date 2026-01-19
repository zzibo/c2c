-- ============================================================================
-- USER SUBMITTED CAFES TABLE
-- ============================================================================
-- This table stores cafes submitted by users before they are approved and
-- added to the main cafes table. This allows for moderation and quality control.
-- ============================================================================

-- Enable PostGIS extension for geographic data
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE cafe_submission_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE user_submitted_cafes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cafe details submitted by user
  name TEXT NOT NULL,
  google_maps_link TEXT NOT NULL,
  location GEOGRAPHY(POINT) NOT NULL,

  -- Submission metadata
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status cafe_submission_status DEFAULT 'pending' NOT NULL,

  -- Review metadata (for admin/moderator use)
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- If approved, reference to the created cafe in the main cafes table
  -- Note: Foreign key constraint added separately to avoid dependency issues
  approved_cafe_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_submitted_cafes_location ON user_submitted_cafes USING GIST(location);
CREATE INDEX idx_user_submitted_cafes_submitted_by ON user_submitted_cafes(submitted_by);
CREATE INDEX idx_user_submitted_cafes_status ON user_submitted_cafes(status);
CREATE INDEX idx_user_submitted_cafes_created_at ON user_submitted_cafes(created_at DESC);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_user_submitted_cafes_updated_at
  BEFORE UPDATE ON user_submitted_cafes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key constraint to cafes table (requires cafes table to exist)
-- This is done separately to avoid dependency issues during migration
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cafes') THEN
    ALTER TABLE user_submitted_cafes
    ADD CONSTRAINT fk_user_submitted_cafes_approved_cafe
    FOREIGN KEY (approved_cafe_id) REFERENCES cafes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- COMMENTS (for documentation)
-- ============================================================================
COMMENT ON TABLE user_submitted_cafes IS 'Stores cafe submissions from users pending moderation';
COMMENT ON COLUMN user_submitted_cafes.google_maps_link IS 'Google Maps link provided by user for verification';
COMMENT ON COLUMN user_submitted_cafes.status IS 'pending: awaiting review, approved: added to cafes table, rejected: declined';
