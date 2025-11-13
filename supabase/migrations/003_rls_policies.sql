-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE cafes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CAFES TABLE POLICIES
-- ============================================================================

-- Public read access for cafes (everyone can view)
CREATE POLICY "Anyone can view cafes"
  ON cafes FOR SELECT
  USING (true);

-- Only service role can insert cafes (via API)
CREATE POLICY "Service role can insert cafes"
  ON cafes FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Only service role can update cafes
CREATE POLICY "Service role can update cafes"
  ON cafes FOR UPDATE
  USING (
    auth.jwt() ->> 'role' = 'service_role'
  );

-- ============================================================================
-- RATINGS TABLE POLICIES
-- ============================================================================

-- Public read access for ratings (everyone can view)
CREATE POLICY "Anyone can view ratings"
  ON ratings FOR SELECT
  USING (true);

-- Authenticated users can create ratings
CREATE POLICY "Authenticated users can create ratings"
  ON ratings FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    auth.uid() = user_id
  );

-- Users can update their own ratings
CREATE POLICY "Users can update their own ratings"
  ON ratings FOR UPDATE
  USING (
    auth.uid() = user_id
  )
  WITH CHECK (
    auth.uid() = user_id
  );

-- Users can delete their own ratings
CREATE POLICY "Users can delete their own ratings"
  ON ratings FOR DELETE
  USING (
    auth.uid() = user_id
  );

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT ON cafes TO authenticated;
GRANT SELECT ON ratings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON ratings TO authenticated;

-- Grant access to anonymous users (read-only for cafes)
GRANT SELECT ON cafes TO anon;
GRANT SELECT ON ratings TO anon;

-- Grant access to service role (full access)
GRANT ALL ON cafes TO service_role;
GRANT ALL ON ratings TO service_role;

-- Grant access to materialized view
GRANT SELECT ON cafe_stats TO anon;
GRANT SELECT ON cafe_stats TO authenticated;
GRANT SELECT ON cafe_stats TO service_role;
