-- Drop the existing policy
DROP POLICY IF EXISTS "Users can create specific notifications" ON public.notifications;

-- Recreate it with 'message' included
CREATE POLICY "Users can create specific notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  type IN ('missed_call', 'bubble_join', 'friend_request', 'friend_request_accepted', 'bubble_invite', 'status_update', 'message')
);
