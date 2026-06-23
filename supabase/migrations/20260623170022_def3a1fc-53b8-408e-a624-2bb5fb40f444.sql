
-- Consolidated Phase 1-3 backend tables
-- Skips conflicting/duplicate legacy migrations; matches frontend store shapes.

-- =====================
-- 1. GEOFENCES
-- =====================
CREATE TABLE IF NOT EXISTS public.geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius INTEGER NOT NULL DEFAULT 100,
  alert_on_enter BOOLEAN NOT NULL DEFAULT true,
  alert_on_leave BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_geofences_user_id ON public.geofences(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.geofences TO authenticated;
GRANT ALL ON public.geofences TO service_role;
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geofences_select_own" ON public.geofences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "geofences_insert_own" ON public.geofences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "geofences_update_own" ON public.geofences FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "geofences_delete_own" ON public.geofences FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =====================
-- 2. TRIPS
-- =====================
DO $$ BEGIN
  CREATE TYPE public.trip_status AS ENUM ('pending', 'active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  origin_lat DOUBLE PRECISION NOT NULL,
  origin_lng DOUBLE PRECISION NOT NULL,
  destination_lat DOUBLE PRECISION NOT NULL,
  destination_lng DOUBLE PRECISION NOT NULL,
  route JSONB,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  eta TIMESTAMPTZ,
  status public.trip_status NOT NULL DEFAULT 'pending',
  shared_with UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trips_created_by ON public.trips(created_by);
CREATE INDEX IF NOT EXISTS idx_trips_shared_with ON public.trips USING gin(shared_with);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trips_select_visible" ON public.trips FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = ANY(shared_with));
CREATE POLICY "trips_insert_own" ON public.trips FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "trips_update_own" ON public.trips FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);
CREATE POLICY "trips_delete_own" ON public.trips FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- =====================
-- 3. VOICE MESSAGES
-- =====================
CREATE TABLE IF NOT EXISTS public.voice_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL,
  url TEXT NOT NULL,
  duration INTEGER NOT NULL,
  is_played BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_voice_messages_chat_id ON public.voice_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_voice_messages_sender_id ON public.voice_messages(sender_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_messages TO authenticated;
GRANT ALL ON public.voice_messages TO service_role;
ALTER TABLE public.voice_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_messages_select_auth" ON public.voice_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "voice_messages_insert_own" ON public.voice_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "voice_messages_delete_own" ON public.voice_messages FOR DELETE TO authenticated USING (auth.uid() = sender_id);

-- =====================
-- 4. USER AVATARS
-- =====================
CREATE TABLE IF NOT EXISTS public.user_avatars (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  icon TEXT NOT NULL DEFAULT 'user',
  color TEXT NOT NULL DEFAULT '#3B82F6',
  custom_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_avatars TO authenticated;
GRANT ALL ON public.user_avatars TO service_role;
ALTER TABLE public.user_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_avatars_select_auth" ON public.user_avatars FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_avatars_insert_own" ON public.user_avatars FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_avatars_update_own" ON public.user_avatars FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_avatars_delete_own" ON public.user_avatars FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =====================
-- 5. DEAD DROPS
-- =====================
DO $$ BEGIN
  CREATE TYPE public.dead_drop_type AS ENUM ('text', 'image', 'voice');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.dead_drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type public.dead_drop_type NOT NULL,
  content TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius INTEGER NOT NULL DEFAULT 50,
  expires_at TIMESTAMPTZ,
  max_views INTEGER,
  viewed_by UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dead_drops_created_by ON public.dead_drops(created_by);
CREATE INDEX IF NOT EXISTS idx_dead_drops_expires ON public.dead_drops(expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dead_drops TO authenticated;
GRANT ALL ON public.dead_drops TO service_role;
ALTER TABLE public.dead_drops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dead_drops_select_auth" ON public.dead_drops FOR SELECT TO authenticated USING (true);
CREATE POLICY "dead_drops_insert_own" ON public.dead_drops FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "dead_drops_update_own" ON public.dead_drops FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "dead_drops_delete_own" ON public.dead_drops FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- =====================
-- 6. LOCATION HISTORY
-- =====================
CREATE TABLE IF NOT EXISTS public.location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  intensity DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  accuracy_meters DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_location_history_user_time ON public.location_history(user_id, recorded_at DESC);

GRANT SELECT, INSERT, DELETE ON public.location_history TO authenticated;
GRANT ALL ON public.location_history TO service_role;
ALTER TABLE public.location_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "location_history_select_own" ON public.location_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "location_history_insert_own" ON public.location_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "location_history_delete_own" ON public.location_history FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =====================
-- 7. REFERRALS
-- =====================
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'active')),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_select_own" ON public.referrals FOR SELECT TO authenticated USING (auth.uid() = referrer_id);
CREATE POLICY "referrals_insert_own" ON public.referrals FOR INSERT TO authenticated WITH CHECK (auth.uid() = referrer_id);
CREATE POLICY "referrals_update_own" ON public.referrals FOR UPDATE TO authenticated USING (auth.uid() = referrer_id);

-- =====================
-- Shared updated_at trigger
-- =====================
DROP TRIGGER IF EXISTS trg_geofences_updated_at ON public.geofences;
CREATE TRIGGER trg_geofences_updated_at BEFORE UPDATE ON public.geofences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_trips_updated_at ON public.trips;
CREATE TRIGGER trg_trips_updated_at BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_user_avatars_updated_at ON public.user_avatars;
CREATE TRIGGER trg_user_avatars_updated_at BEFORE UPDATE ON public.user_avatars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
