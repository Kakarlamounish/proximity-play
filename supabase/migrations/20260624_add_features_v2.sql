-- ============================================================
-- Migration: Add Hangout Zones, Safety Alerts, and helpers
-- ============================================================

-- Hangout Zones: temporary group presence circles
CREATE TABLE IF NOT EXISTS hangout_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Hangout Zone',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius INTEGER NOT NULL DEFAULT 100, -- meters
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bubble_id UUID REFERENCES bubbles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '4 hours'),
  inside_user_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security for hangout_zones
ALTER TABLE hangout_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all active hangout zones"
  ON hangout_zones FOR SELECT
  USING (expires_at > NOW());

CREATE POLICY "Users can create their own hangout zones"
  ON hangout_zones FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can delete their zones"
  ON hangout_zones FOR DELETE
  USING (auth.uid() = created_by);

CREATE POLICY "Creators can update their zones"
  ON hangout_zones FOR UPDATE
  USING (auth.uid() = created_by);

-- Safety Alerts: logged safety check events
CREATE TABLE IF NOT EXISTS safety_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('stationary_alert', 'check_in', 'emergency')),
  response TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for safety_alerts
ALTER TABLE safety_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own alerts"
  ON safety_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own alerts"
  ON safety_alerts FOR SELECT
  USING (auth.uid() = user_id);

-- Ensure dead_drops table exists (may already be there from previous migrations)
CREATE TABLE IF NOT EXISTS dead_drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Secret Message',
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'voice')),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius INTEGER NOT NULL DEFAULT 50, -- meters
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  viewed_by UUID[] DEFAULT '{}',
  max_views INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dead_drops ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dead_drops' AND policyname = 'Anyone can view dead drops'
  ) THEN
    CREATE POLICY "Anyone can view dead drops"
      ON dead_drops FOR SELECT
      USING (auth.uid() IS NOT NULL AND (expires_at IS NULL OR expires_at > NOW()));

    CREATE POLICY "Users can create dead drops"
      ON dead_drops FOR INSERT
      WITH CHECK (auth.uid() = created_by);

    CREATE POLICY "Users can update viewed_by on dead drops"
      ON dead_drops FOR UPDATE
      USING (auth.uid() IS NOT NULL);

    CREATE POLICY "Creators can delete dead drops"
      ON dead_drops FOR DELETE
      USING (auth.uid() = created_by);
  END IF;
END $$;

-- Helper RPC to get nearby dead drops (within 1km)
CREATE OR REPLACE FUNCTION get_nearby_dead_drops(user_lat DOUBLE PRECISION, user_lng DOUBLE PRECISION)
RETURNS SETOF dead_drops
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT *
  FROM dead_drops
  WHERE
    (expires_at IS NULL OR expires_at > NOW())
    AND (
      6371000 * 2 * ASIN(
        SQRT(
          POWER(SIN((RADIANS(latitude) - RADIANS(user_lat)) / 2), 2)
          + COS(RADIANS(user_lat)) * COS(RADIANS(latitude))
          * POWER(SIN((RADIANS(longitude) - RADIANS(user_lng)) / 2), 2)
        )
      )
    ) <= 1000
  ORDER BY created_at DESC
  LIMIT 50;
$$;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_hangout_zones_expires ON hangout_zones(expires_at);
CREATE INDEX IF NOT EXISTS idx_dead_drops_location ON dead_drops(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_safety_alerts_user ON safety_alerts(user_id, created_at);
