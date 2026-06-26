-- Restore the ability for authenticated users to create notifications
-- Restricted to specific safe notification types inserted by the client.

CREATE POLICY "Users can create specific notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  type IN ('missed_call', 'bubble_join', 'friend_request', 'friend_request_accepted', 'bubble_invite', 'status_update')
);
