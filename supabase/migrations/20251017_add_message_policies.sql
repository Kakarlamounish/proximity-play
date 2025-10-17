BEGIN;

-- Enable Row Level Security on messages table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Allow users to SELECT messages where they are sender or recipient
CREATE POLICY "select_own_messages" ON public.messages
  FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Allow users to INSERT messages where sender_id matches the authenticated user
CREATE POLICY "insert_own_messages" ON public.messages
  FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- If your messages are tied to conversations, require participant membership to SELECT
CREATE POLICY "select_conversation_messages" ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = public.messages.conversation_id
        AND cp.user_id = auth.uid()
    )
  );

-- And require participant membership to INSERT messages into a conversation
CREATE POLICY "insert_conversation_messages" ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = public.messages.conversation_id
        AND cp.user_id = auth.uid()
    )
  );

COMMIT;