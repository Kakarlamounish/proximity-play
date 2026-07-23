-- Supports BUG-018 (user blocking): the RLS policy on user_blocks only lets
-- a user read rows where they are the blocker (blocker_id), by design — a
-- user should not be able to enumerate who has blocked them. That means a
-- blocked user's own client can't see "the other person blocked me" via a
-- normal select, which is exactly the direction that most needs enforcing
-- (stopping a blocked user from friend-requesting/messaging/calling the
-- person who blocked them). This function checks both directions
-- server-side and returns only a boolean, never the underlying rows.
create or replace function public.is_blocked(user_a uuid, user_b uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = user_a and blocked_id = user_b)
       or (blocker_id = user_b and blocked_id = user_a)
  );
$$;

grant execute on function public.is_blocked(uuid, uuid) to authenticated;
