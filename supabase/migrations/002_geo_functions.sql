-- ============================================================================
-- FUNCTION: Get nearby cafes with ratings
-- ============================================================================
CREATE OR REPLACE FUNCTION get_nearby_cafes(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_meters INT DEFAULT 5000,
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
  distance_meters FLOAT,
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
    ST_Distance(
      cs.location::geography,
      ST_MakePoint(user_lng, user_lat)::geography
    )::FLOAT as distance_meters,
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
  WHERE ST_DWithin(
    cs.location::geography,
    ST_MakePoint(user_lng, user_lat)::geography,
    radius_meters
  )
  AND cs.avg_overall >= min_rating
  ORDER BY
    -- Prioritize: cafes with ratings, then by rating, then by distance
    CASE WHEN cs.rating_count > 0 THEN 0 ELSE 1 END,
    cs.avg_overall DESC,
    distance_meters ASC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Search cafes by name (full-text search)
-- ============================================================================
CREATE OR REPLACE FUNCTION search_cafes_by_name(
  search_query TEXT,
  user_lat FLOAT DEFAULT NULL,
  user_lng FLOAT DEFAULT NULL,
  max_distance_meters INT DEFAULT 10000,
  result_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  display_name TEXT,
  address TEXT,
  latitude FLOAT,
  longitude FLOAT,
  distance_meters FLOAT,
  avg_overall NUMERIC,
  rating_count BIGINT,
  relevance FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.id,
    cs.name,
    cs.display_name,
    cs.address,
    ST_Y(cs.location::geometry) as latitude,
    ST_X(cs.location::geometry) as longitude,
    CASE
      WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
        ST_Distance(
          cs.location::geography,
          ST_MakePoint(user_lng, user_lat)::geography
        )::FLOAT
      ELSE NULL
    END as distance_meters,
    cs.avg_overall,
    cs.rating_count,
    ts_rank(
      to_tsvector('english', cs.display_name || ' ' || COALESCE(cs.address, '')),
      plainto_tsquery('english', search_query)
    )::FLOAT as relevance
  FROM cafe_stats cs
  WHERE
    to_tsvector('english', cs.display_name || ' ' || COALESCE(cs.address, ''))
    @@ plainto_tsquery('english', search_query)
    AND (
      user_lat IS NULL OR user_lng IS NULL OR
      ST_DWithin(
        cs.location::geography,
        ST_MakePoint(user_lng, user_lat)::geography,
        max_distance_meters
      )
    )
  ORDER BY
    relevance DESC,
    cs.avg_overall DESC,
    distance_meters ASC NULLS LAST
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get cafe by ID with full details
-- ============================================================================
CREATE OR REPLACE FUNCTION get_cafe_details(cafe_id UUID)
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
  created_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ
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
    cs.created_at,
    cs.last_synced_at
  FROM cafe_stats cs
  WHERE cs.id = cafe_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get user's ratings
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_ratings(user_uuid UUID)
RETURNS TABLE (
  rating_id UUID,
  cafe_id UUID,
  cafe_name TEXT,
  coffee_rating NUMERIC,
  vibe_rating NUMERIC,
  wifi_rating NUMERIC,
  outlets_rating NUMERIC,
  seating_rating NUMERIC,
  noise_rating NUMERIC,
  overall_rating NUMERIC,
  comment TEXT,
  photos TEXT[],
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id as rating_id,
    r.cafe_id,
    c.name as cafe_name,
    r.coffee_rating,
    r.vibe_rating,
    r.wifi_rating,
    r.outlets_rating,
    r.seating_rating,
    r.noise_rating,
    r.overall_rating,
    r.comment,
    r.photos,
    r.created_at
  FROM ratings r
  JOIN cafes c ON r.cafe_id = c.id
  WHERE r.user_id = user_uuid
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql;
