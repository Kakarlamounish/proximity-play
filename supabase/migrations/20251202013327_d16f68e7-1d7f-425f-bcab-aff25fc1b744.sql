-- Create call_logs table for tracking call history
CREATE TABLE public.call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id UUID NOT NULL,
  receiver_id UUID,
  bubble_id UUID REFERENCES public.bubbles(id) ON DELETE SET NULL,
  call_type TEXT NOT NULL CHECK (call_type IN ('audio', 'video')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ringing', 'connected', 'ended', 'missed', 'declined')),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own call logs (as caller or receiver)
CREATE POLICY "Users can view their own calls" 
ON public.call_logs 
FOR SELECT 
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Users can create calls where they are the caller
CREATE POLICY "Users can create calls as caller" 
ON public.call_logs 
FOR INSERT 
WITH CHECK (auth.uid() = caller_id);

-- Users can update calls they are part of
CREATE POLICY "Users can update their calls" 
ON public.call_logs 
FOR UPDATE 
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Add realtime for call_logs
ALTER TABLE public.call_logs REPLICA IDENTITY FULL;