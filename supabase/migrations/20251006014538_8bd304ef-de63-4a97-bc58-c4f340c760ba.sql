-- Create friend_requests table
CREATE TABLE public.friend_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

-- Enable RLS
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

-- Policies for friend_requests
CREATE POLICY "Users can send friend requests"
ON public.friend_requests
FOR INSERT
WITH CHECK (auth.uid() = sender_id AND sender_id != receiver_id);

CREATE POLICY "Users can view their friend requests"
ON public.friend_requests
FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can respond to friend requests"
ON public.friend_requests
FOR UPDATE
USING (auth.uid() = receiver_id);

CREATE POLICY "Users can delete their sent requests"
ON public.friend_requests
FOR DELETE
USING (auth.uid() = sender_id);

-- Create friendships table (accepted connections)
CREATE TABLE public.friendships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id_1 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id_2 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CHECK (user_id_1 < user_id_2),
  UNIQUE(user_id_1, user_id_2)
);

-- Enable RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Policies for friendships
CREATE POLICY "Users can view their friendships"
ON public.friendships
FOR SELECT
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Function to create friendship when request is accepted
CREATE OR REPLACE FUNCTION public.handle_friend_request_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO public.friendships (user_id_1, user_id_2)
    VALUES (
      LEAST(NEW.sender_id, NEW.receiver_id),
      GREATEST(NEW.sender_id, NEW.receiver_id)
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create friendship
CREATE TRIGGER on_friend_request_accepted
  AFTER UPDATE ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_friend_request_accepted();

-- Create activities table for feed
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bubble_id UUID REFERENCES public.bubbles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('joined_bubble', 'created_bubble', 'created_meetup', 'new_status', 'earned_badge', 'new_friend')),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Policy for activities
CREATE POLICY "Users can view activities from their bubbles and friends"
ON public.activities
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bubble_memberships
    WHERE bubble_memberships.bubble_id = activities.bubble_id
    AND bubble_memberships.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (friendships.user_id_1 = auth.uid() AND friendships.user_id_2 = activities.user_id)
    OR (friendships.user_id_2 = auth.uid() AND friendships.user_id_1 = activities.user_id)
  )
  OR auth.uid() = activities.user_id
);

-- Create indexes for performance
CREATE INDEX idx_friend_requests_sender ON public.friend_requests(sender_id);
CREATE INDEX idx_friend_requests_receiver ON public.friend_requests(receiver_id);
CREATE INDEX idx_friend_requests_status ON public.friend_requests(status);
CREATE INDEX idx_friendships_user1 ON public.friendships(user_id_1);
CREATE INDEX idx_friendships_user2 ON public.friendships(user_id_2);
CREATE INDEX idx_activities_user ON public.activities(user_id);
CREATE INDEX idx_activities_bubble ON public.activities(bubble_id);
CREATE INDEX idx_activities_created ON public.activities(created_at DESC);