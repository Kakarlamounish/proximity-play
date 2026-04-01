
-- Fix profiles SELECT policy: restrict to authenticated users and respect ghost_mode
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (ghost_mode = false OR auth.uid() = id);

-- Fix notifications INSERT policy: restrict to authenticated users inserting for themselves
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "Authenticated users can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
