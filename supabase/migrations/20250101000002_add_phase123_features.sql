-- Phase 1: Geofencing
CREATE TABLE IF NOT EXISTS geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius INTEGER NOT NULL DEFAULT 100,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES auth.users(id),
  alert_on_enter BOOLEAN DEFAULT true,
  alert_on_leave BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_geofences_user_id ON geofences(user_id);
CREATE INDEX idx_geofences_location ON geofences USING gist(ll_to_earth(latitude, longitude));

-- Phase 2: Live Trips
CREATE TYPE trip_status AS ENUM ('pending', 'active', 'completed', 'cancelled');

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  origin_lat DOUBLE PRECISION NOT NULL,
  origin_lng DOUBLE PRECISION NOT NULL,
  destination_lat DOUBLE PRECISION NOT NULL,
  destination_lng DOUBLE PRECISION NOT NULL,
  route JSONB, -- Array of {lat, lng} points
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  eta TIMESTAMPTZ,
  status trip_status DEFAULT 'pending',
  shared_with UUID[],
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trips_created_by ON trips(created_by);
CREATE INDEX idx_trips_shared_with ON trips USING gin(shared_with);
CREATE INDEX idx_trips_status ON trips(status);

-- Phase 2: Voice Notes
CREATE TABLE IF NOT EXISTS voice_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  duration INTEGER NOT NULL, -- seconds
  chat_id UUID NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_played BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_voice_messages_chat_id ON voice_messages(chat_id);
CREATE INDEX idx_voice_messages_sender_id ON voice_messages(sender_id);

-- Phase 2: User Avatars
CREATE TABLE IF NOT EXISTS user_avatars (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  icon TEXT NOT NULL DEFAULT 'user',
  color TEXT NOT NULL DEFAULT '#3B82F6',
  custom_image_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Phase 3: Dead Drops
CREATE TYPE dead_drop_type AS ENUM ('text', 'image', 'voice');

CREATE TABLE IF NOT EXISTS dead_drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius INTEGER NOT NULL DEFAULT 50,
  type dead_drop_type NOT NULL,
  content TEXT NOT NULL,
  title TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  viewed_by UUID[] DEFAULT '{}',
  max_views INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dead_drops_location ON dead_drops USING gist(ll_to_earth(latitude, longitude));
CREATE INDEX idx_dead_drops_created_by ON dead_drops(created_by);
CREATE INDEX idx_dead_drops_expires ON dead_drops(expires_at);

-- Phase 3: Location History (for Heatmaps)
CREATE TABLE IF NOT EXISTS location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  intensity DOUBLE PRECISION DEFAULT 1.0,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_location_history_user_id ON location_history(user_id);
CREATE INDEX idx_location_history_recorded ON location_history(recorded_at);
CREATE INDEX idx_location_history_location ON location_history USING gist(ll_to_earth(latitude, longitude));

-- Phase 3: Referrals
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id),
  referred_email TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'signed_up', 'active')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  activated_at TIMESTAMPTZ
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_status ON referrals(status);

-- RLS Policies
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE dead_drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Geofences policies
CREATE POLICY "Users can view their own geofences"
  ON geofences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own geofences"
  ON geofences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own geofences"
  ON geofences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own geofences"
  ON geofences FOR DELETE
  USING (auth.uid() = user_id);

-- Trips policies
CREATE POLICY "Users can view trips shared with them"
  ON trips FOR SELECT
  USING (auth.uid() = created_by OR auth.uid() = ANY(shared_with));

CREATE POLICY "Users can create trips"
  ON trips FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Voice messages policies
CREATE POLICY "Users can view voice messages in their chats"
  ON voice_messages FOR SELECT
  USING (true); -- Add chat membership check in production

CREATE POLICY "Users can send voice messages"
  ON voice_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Avatars policies
CREATE POLICY "Users can view all avatars"
  ON user_avatars FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own avatar"
  ON user_avatars FOR UPDATE
  USING (auth.uid() = user_id);

-- Dead drops policies
CREATE POLICY "Users can view nearby dead drops"
  ON dead_drops FOR SELECT
  USING (true); -- Add proximity check in production via function

CREATE POLICY "Users can create dead drops"
  ON dead_drops FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Location history policies
CREATE POLICY "Users can view their own location history"
  ON location_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own location history"
  ON location_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Referrals policies
CREATE POLICY "Users can view their own referrals"
  ON referrals FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Users can create referrals"
  ON referrals FOR INSERT
  WITH CHECK (auth.uid() = referrer_id);
