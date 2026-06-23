-- Phase 1: Geofencing, Trips, and User Preferences
-- Run this migration to add support for advanced location features

-- 1. Create Geofences table
CREATE TABLE IF NOT EXISTS public.geofences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 100,
  trigger_type TEXT NOT NULL DEFAULT 'enter' CHECK (trigger_type IN ('enter', 'exit', 'both')),
  target_user_id UUID REFERENCES auth.users(id), -- Optional: alert when specific friend enters/exits
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Live Trips table
CREATE TABLE IF NOT EXISTS public.live_trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  destination_name TEXT NOT NULL,
  destination_lat DOUBLE PRECISION NOT NULL,
  destination_lng DOUBLE PRECISION NOT NULL,
  route_geometry JSONB, -- GeoJSON LineString
  eta TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  shared_with UUID[], -- Array of user IDs who can see this trip
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add battery_saver_mode and custom_avatar to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS battery_saver_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_avatar_url TEXT,
ADD COLUMN IF NOT EXISTS map_icon_style TEXT DEFAULT 'default',
ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#3B82F6';

-- 4. Add location_history for heatmaps (optional, privacy-permitting)
CREATE TABLE IF NOT EXISTS public.location_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  accuracy_meters DOUBLE PRECISION
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_geofences_user_id ON public.geofences(user_id);
CREATE INDEX IF NOT EXISTS idx_geofences_active ON public.geofences(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_live_trips_user_id ON public.live_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_live_trips_status ON public.live_trips(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_location_history_user_time 
  ON public.location_history(user_id, recorded_at DESC);

-- 6. Enable PostGIS extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- 7. Add RLS Policies for Geofences
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own geofences"
  ON public.geofences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own geofences"
  ON public.geofences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own geofences"
  ON public.geofences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own geofences"
  ON public.geofences FOR DELETE
  USING (auth.uid() = user_id);

-- Allow viewing geofences where you are the target (for shared alerts)
CREATE POLICY "Target users can view geofences targeting them"
  ON public.geofences FOR SELECT
  USING (target_user_id = auth.uid());

-- 8. Add RLS Policies for Live Trips
ALTER TABLE public.live_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trips"
  ON public.live_trips FOR SELECT
  USING (auth.uid() = user_id OR shared_with @> ARRAY[auth.uid()]);

CREATE POLICY "Users can create their own trips"
  ON public.live_trips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trips"
  ON public.live_trips FOR UPDATE
  USING (auth.uid() = user_id);

-- 9. Add RLS Policies for Location History
ALTER TABLE public.location_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own location history"
  ON public.location_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own location history"
  ON public.location_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 10. Create function to clean up old location history (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_location_history()
RETURNS void AS $$
BEGIN
  DELETE FROM public.location_history
  WHERE recorded_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_location_history IS 'Deletes location history older than 30 days';

-- 11. Create notification queue for geofence alerts
CREATE TABLE IF NOT EXISTS public.geofence_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  geofence_id UUID REFERENCES public.geofences(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  triggered_by_user_id UUID REFERENCES auth.users(id),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('enter', 'exit')),
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  is_read BOOLEAN DEFAULT false,
  message TEXT
);

CREATE INDEX IF NOT EXISTS idx_geofence_notifications_user ON public.geofence_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_geofence_notifications_unread 
  ON public.geofence_notifications(user_id, is_read) WHERE is_read = false;

ALTER TABLE public.geofence_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.geofence_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.geofence_notifications FOR INSERT
  WITH CHECK (true); -- Will be controlled by Edge Function

CREATE POLICY "Users can mark their notifications as read"
  ON public.geofence_notifications FOR UPDATE
  USING (auth.uid() = user_id);
