-- Enable PostGIS extension for geographic data
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create users table extension (Supabase auth.users exists by default)
-- We'll reference auth.users for user_id foreign keys

-- ============================================================================
-- CAFES TABLE
-- ============================================================================
CREATE TABLE cafes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Geoapify/OSM identifiers
  geoapify_place_id TEXT UNIQUE NOT NULL,
  osm_id TEXT,

  -- Basic info from Geoapify
  name TEXT NOT NULL,
  address TEXT,
  location GEOGRAPHY(POINT) NOT NULL,
  phone TEXT,
  website TEXT,

  -- User-enriched data (better than API data over time)
  verified_name TEXT,
  verified_hours JSONB,
  user_photos TEXT[] DEFAULT '{}',

  -- Metadata
  first_discovered_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_cafes_location ON cafes USING GIST(location);
CREATE INDEX idx_cafes_geoapify_place_id ON cafes(geoapify_place_id);
CREATE INDEX idx_cafes_name ON cafes USING GIN(to_tsvector('english', name));

-- ============================================================================
-- RATINGS TABLE
-- ============================================================================
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id UUID REFERENCES cafes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Your 6 rating categories (1-5 scale)
  coffee_rating DECIMAL(2,1) CHECK (coffee_rating >= 1 AND coffee_rating <= 5),
  vibe_rating DECIMAL(2,1) CHECK (vibe_rating >= 1 AND vibe_rating <= 5),
  wifi_rating DECIMAL(2,1) CHECK (wifi_rating >= 1 AND wifi_rating <= 5),
  outlets_rating DECIMAL(2,1) CHECK (outlets_rating >= 1 AND outlets_rating <= 5),
  seating_rating DECIMAL(2,1) CHECK (seating_rating >= 1 AND seating_rating <= 5),
  noise_rating DECIMAL(2,1) CHECK (noise_rating >= 1 AND noise_rating <= 5),

  -- Auto-calculated overall rating
  overall_rating DECIMAL(2,1) GENERATED ALWAYS AS (
    (COALESCE(coffee_rating, 0) + COALESCE(vibe_rating, 0) + COALESCE(wifi_rating, 0) +
     COALESCE(outlets_rating, 0) + COALESCE(seating_rating, 0) + COALESCE(noise_rating, 0)) /
    NULLIF((CASE WHEN coffee_rating IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN vibe_rating IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN wifi_rating IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN outlets_rating IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN seating_rating IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN noise_rating IS NOT NULL THEN 1 ELSE 0 END), 0)
  ) STORED,

  -- Optional fields
  comment TEXT,
  photos TEXT[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: One rating per user per cafe
  UNIQUE(cafe_id, user_id)
);

-- Indexes
CREATE INDEX idx_ratings_cafe ON ratings(cafe_id);
CREATE INDEX idx_ratings_user ON ratings(user_id);
CREATE INDEX idx_ratings_overall ON ratings(overall_rating DESC);

-- ============================================================================
-- MATERIALIZED VIEW: Cafe Stats (for performance)
-- ============================================================================
CREATE MATERIALIZED VIEW cafe_stats AS
SELECT
  c.id,
  c.geoapify_place_id,
  c.name,
  COALESCE(c.verified_name, c.name) as display_name,
  c.address,
  c.location,
  c.phone,
  c.website,
  c.user_photos,
  c.verified_hours,

  -- Rating statistics
  COUNT(r.id) as rating_count,
  COALESCE(AVG(r.coffee_rating), 0) as avg_coffee,
  COALESCE(AVG(r.vibe_rating), 0) as avg_vibe,
  COALESCE(AVG(r.wifi_rating), 0) as avg_wifi,
  COALESCE(AVG(r.outlets_rating), 0) as avg_outlets,
  COALESCE(AVG(r.seating_rating), 0) as avg_seating,
  COALESCE(AVG(r.noise_rating), 0) as avg_noise,
  COALESCE(AVG(r.overall_rating), 0) as avg_overall,

  -- Engagement metrics
  MAX(r.created_at) as last_rated_at,
  c.created_at,
  c.last_synced_at
FROM cafes c
LEFT JOIN ratings r ON c.id = r.cafe_id
GROUP BY c.id;

-- Indexes on materialized view
CREATE UNIQUE INDEX idx_cafe_stats_id ON cafe_stats(id);
CREATE INDEX idx_cafe_stats_location ON cafe_stats USING GIST(location);
CREATE INDEX idx_cafe_stats_avg_overall ON cafe_stats(avg_overall DESC);
CREATE INDEX idx_cafe_stats_rating_count ON cafe_stats(rating_count DESC);

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cafes_updated_at
  BEFORE UPDATE ON cafes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ratings_updated_at
  BEFORE UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTION: Refresh materialized view
-- ============================================================================
CREATE OR REPLACE FUNCTION refresh_cafe_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY cafe_stats;
END;
$$ LANGUAGE plpgsql;

-- Initial refresh
REFRESH MATERIALIZED VIEW cafe_stats;
