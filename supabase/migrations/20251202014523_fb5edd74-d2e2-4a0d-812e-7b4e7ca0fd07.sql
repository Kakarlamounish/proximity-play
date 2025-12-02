-- Drop the overly restrictive policy that blocks all operations
DROP POLICY IF EXISTS "Only system can manage bubbles" ON public.bubbles;

-- Create a proper INSERT policy for authenticated users to create bubbles
CREATE POLICY "Authenticated users can create bubbles" 
ON public.bubbles 
FOR INSERT 
WITH CHECK (auth.uid() = creator_id);