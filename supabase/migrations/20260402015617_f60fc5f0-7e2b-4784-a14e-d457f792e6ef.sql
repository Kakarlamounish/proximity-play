
-- Enable realtime on friendships
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;

-- Enable realtime on profiles
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- Enable realtime on activities
ALTER PUBLICATION supabase_realtime ADD TABLE activities;

-- Enable realtime on bubbles
ALTER PUBLICATION supabase_realtime ADD TABLE bubbles;

-- Enable realtime on call_logs
ALTER PUBLICATION supabase_realtime ADD TABLE call_logs;

-- Create user_presence table for online/offline status
CREATE TABLE IF NOT EXISTS public.user_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'offline',
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view presence
CREATE POLICY "Authenticated users can view presence"
  ON public.user_presence FOR SELECT
  TO authenticated
  USING (true);

-- Users can upsert their own presence
CREATE POLICY "Users can insert their own presence"
  ON public.user_presence FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presence"
  ON public.user_presence FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime on user_presence
ALTER PUBLICATION supabase_realtime ADD TABLE user_presence;

-- Add RLS policy for friendships INSERT (needed for the trigger)
CREATE POLICY "System can insert friendships"
  ON public.friendships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Add DELETE policy on friendships for unfriending
CREATE POLICY "Users can delete their friendships"
  ON public.friendships FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);
