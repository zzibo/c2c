-- ============================================================================
-- USER SUBMITTED CAFES TABLE
-- ============================================================================
-- This table stores cafes submitted by users before they are approved and
-- added to the main cafes table. This allows for moderation and quality control.
-- ============================================================================

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
  approved_cafe_id UUID REFERENCES cafes(id) ON DELETE SET NULL,

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

-- ============================================================================
-- FUNCTION: Approve user-submitted cafe and create in main cafes table
-- ============================================================================
CREATE OR REPLACE FUNCTION approve_user_submitted_cafe(
  submission_id UUID,
  reviewer_user_id UUID,
  geoapify_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_cafe_id UUID;
  submission RECORD;
BEGIN
  -- Get submission details
  SELECT * INTO submission
  FROM user_submitted_cafes
  WHERE id = submission_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found or already processed';
  END IF;

  -- Create cafe in main cafes table
  -- Note: geoapify_place_id will be the submission UUID if no Geoapify data
  INSERT INTO cafes (
    geoapify_place_id,
    name,
    address,
    location,
    website,
    verified_name
  ) VALUES (
    COALESCE(geoapify_data->>'place_id', 'user_submitted_' || submission_id::text),
    submission.name,
    COALESCE(geoapify_data->>'address', ''),
    submission.location,
    submission.google_maps_link,
    submission.name
  )
  RETURNING id INTO new_cafe_id;

  -- Update submission status
  UPDATE user_submitted_cafes
  SET
    status = 'approved',
    approved_cafe_id = new_cafe_id,
    reviewed_by = reviewer_user_id,
    reviewed_at = NOW()
  WHERE id = submission_id;

  -- Refresh materialized view
  PERFORM refresh_cafe_stats();

  RETURN new_cafe_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Reject user-submitted cafe
-- ============================================================================
CREATE OR REPLACE FUNCTION reject_user_submitted_cafe(
  submission_id UUID,
  reviewer_user_id UUID,
  rejection_reason TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE user_submitted_cafes
  SET
    status = 'rejected',
    reviewed_by = reviewer_user_id,
    reviewed_at = NOW(),
    review_notes = rejection_reason
  WHERE id = submission_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found or already processed';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS (for documentation)
-- ============================================================================
COMMENT ON TABLE user_submitted_cafes IS 'Stores cafe submissions from users pending moderation';
COMMENT ON COLUMN user_submitted_cafes.google_maps_link IS 'Google Maps link provided by user for verification';
COMMENT ON COLUMN user_submitted_cafes.status IS 'pending: awaiting review, approved: added to cafes table, rejected: declined';
COMMENT ON FUNCTION approve_user_submitted_cafe IS 'Approves a submission and creates a cafe in the main cafes table';
COMMENT ON FUNCTION reject_user_submitted_cafe IS 'Rejects a submission with optional reason';
