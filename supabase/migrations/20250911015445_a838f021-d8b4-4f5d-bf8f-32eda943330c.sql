-- Create live_locations table for real-time location sharing
CREATE TABLE public.live_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bubble_id UUID NOT NULL REFERENCES public.bubbles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create status_updates table for user status posts
CREATE TABLE public.status_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bubble_id UUID NOT NULL REFERENCES public.bubbles(id) ON DELETE CASCADE,
  status_text TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '😊',
  activity_type TEXT NOT NULL DEFAULT 'available',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create status_reactions table for reactions to status updates
CREATE TABLE public.status_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_id UUID NOT NULL REFERENCES public.status_updates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(status_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_reactions ENABLE ROW LEVEL SECURITY;

-- Create policies for live_locations
CREATE POLICY "Users can view live locations in their bubbles" 
ON public.live_locations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.bubble_memberships 
    WHERE bubble_id = live_locations.bubble_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own live location" 
ON public.live_locations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own live location" 
ON public.live_locations 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own live location" 
ON public.live_locations 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for status_updates
CREATE POLICY "Users can view status updates in their bubbles" 
ON public.status_updates 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.bubble_memberships 
    WHERE bubble_id = status_updates.bubble_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own status updates" 
ON public.status_updates 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own status updates" 
ON public.status_updates 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own status updates" 
ON public.status_updates 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for status_reactions
CREATE POLICY "Users can view reactions in their bubbles" 
ON public.status_reactions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.status_updates su
    INNER JOIN public.bubble_memberships bm ON su.bubble_id = bm.bubble_id
    WHERE su.id = status_reactions.status_id 
    AND bm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create reactions" 
ON public.status_reactions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reactions" 
ON public.status_reactions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_live_locations_bubble_id ON public.live_locations(bubble_id);
CREATE INDEX idx_live_locations_expires_at ON public.live_locations(expires_at);
CREATE INDEX idx_status_updates_bubble_id ON public.status_updates(bubble_id);
CREATE INDEX idx_status_updates_expires_at ON public.status_updates(expires_at);
CREATE INDEX idx_status_reactions_status_id ON public.status_reactions(status_id);

-- Add triggers for updated_at columns
CREATE TRIGGER update_live_locations_updated_at
BEFORE UPDATE ON public.live_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_status_updates_updated_at
BEFORE UPDATE ON public.status_updates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add realtime for the new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.status_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.status_reactions;