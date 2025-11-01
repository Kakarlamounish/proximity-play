-- Create location_stories table for the Stories feature
CREATE TABLE IF NOT EXISTS public.location_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text_content TEXT,
  image_url TEXT,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  visibility_radius INTEGER DEFAULT 5000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.location_stories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view nearby stories"
ON public.location_stories FOR SELECT
USING (true);

CREATE POLICY "Users can create their own stories"
ON public.location_stories FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stories"
ON public.location_stories FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stories"
ON public.location_stories FOR DELETE
USING (auth.uid() = user_id);

-- Add index for location queries
CREATE INDEX idx_location_stories_location ON public.location_stories(latitude, longitude);
CREATE INDEX idx_location_stories_expires ON public.location_stories(expires_at);

-- Create privacy_schedules table for the Settings feature
CREATE TABLE IF NOT EXISTS public.privacy_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.privacy_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own schedules"
ON public.privacy_schedules FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own schedules"
ON public.privacy_schedules FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own schedules"
ON public.privacy_schedules FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own schedules"
ON public.privacy_schedules FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at on location_stories
CREATE TRIGGER update_location_stories_updated_at
BEFORE UPDATE ON public.location_stories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on privacy_schedules
CREATE TRIGGER update_privacy_schedules_updated_at
BEFORE UPDATE ON public.privacy_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();