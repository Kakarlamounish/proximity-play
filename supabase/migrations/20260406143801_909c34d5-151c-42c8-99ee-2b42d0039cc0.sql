
-- Snap Streaks table
CREATE TABLE public.snap_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id_1 UUID NOT NULL,
  user_id_2 UUID NOT NULL,
  streak_count INTEGER NOT NULL DEFAULT 1,
  last_snap_by UUID,
  last_snap_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id_1, user_id_2)
);

ALTER TABLE public.snap_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own streaks" ON public.snap_streaks
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE POLICY "Users can insert their own streaks" ON public.snap_streaks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE POLICY "Users can update their own streaks" ON public.snap_streaks
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Snap Score table  
CREATE TABLE public.snap_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  snaps_sent INTEGER NOT NULL DEFAULT 0,
  snaps_received INTEGER NOT NULL DEFAULT 0,
  stories_posted INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.snap_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view snap scores" ON public.snap_scores
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own score" ON public.snap_scores
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own score" ON public.snap_scores
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Add disappearing message columns to messages (viewed tracking)
ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS is_disappearing BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE snap_streaks;
ALTER PUBLICATION supabase_realtime ADD TABLE snap_scores;
