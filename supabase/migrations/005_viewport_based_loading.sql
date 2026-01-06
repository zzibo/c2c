-- ============================================================================
-- MIGRATION 005: Viewport-Based Loading for Map
-- Created: 2026-01-06
-- Purpose: Add bounding box query function for efficient viewport-based cafe loading
-- ============================================================================

-- ============================================================================
-- FUNCTION: Get cafes within bounding box (viewport-based loading)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_cafes_in_bounds(
  north_lat FLOAT,
  south_lat FLOAT,
  east_lng FLOAT,
  west_lng FLOAT,
  min_rating FLOAT DEFAULT 0,
  result_limit INT DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  geoapify_place_id TEXT,
  name TEXT,
  display_name TEXT,
  address TEXT,
  latitude FLOAT,
  longitude FLOAT,
  phone TEXT,
  website TEXT,
  user_photos TEXT[],
  verified_hours JSONB,
  rating_count BIGINT,
  avg_coffee NUMERIC,
  avg_vibe NUMERIC,
  avg_wifi NUMERIC,
  avg_outlets NUMERIC,
  avg_seating NUMERIC,
  avg_noise NUMERIC,
  avg_overall NUMERIC,
  last_rated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.id,
    cs.geoapify_place_id,
    cs.name,
    cs.display_name,
    cs.address,
    ST_Y(cs.location::geometry) as latitude,
    ST_X(cs.location::geometry) as longitude,
    cs.phone,
    cs.website,
    cs.user_photos,
    cs.verified_hours,
    cs.rating_count,
    cs.avg_coffee,
    cs.avg_vibe,
    cs.avg_wifi,
    cs.avg_outlets,
    cs.avg_seating,
    cs.avg_noise,
    cs.avg_overall,
    cs.last_rated_at,
    cs.created_at
  FROM cafe_stats cs
  WHERE
    -- Bounding box intersection using PostGIS
    -- ST_MakeEnvelope(west, south, east, north, SRID)
    ST_Intersects(
      cs.location::geometry,
      ST_MakeEnvelope(west_lng, south_lat, east_lng, north_lat, 4326)
    )
    AND cs.avg_overall >= min_rating
  ORDER BY
    -- Prioritize cafes with ratings, then by rating value, then by rating count
    CASE WHEN cs.rating_count > 0 THEN 0 ELSE 1 END,
    cs.avg_overall DESC,
    cs.rating_count DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INDEX: Ensure GIST spatial index exists for bounding box queries
-- ============================================================================
-- This index enables fast ST_Intersects queries on the location column
-- It should already exist from migration 001, but we ensure it here
CREATE INDEX IF NOT EXISTS idx_cafe_stats_location_gist
ON cafe_stats USING GIST(location);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Run this migration: psql -h ... -U ... -d ... -f 005_viewport_based_loading.sql
-- 2. Test function: SELECT * FROM get_cafes_in_bounds(37.8, 37.7, -122.3, -122.5);
-- 3. Create API endpoint: /app/api/cafes/viewport/route.ts
-- ============================================================================
