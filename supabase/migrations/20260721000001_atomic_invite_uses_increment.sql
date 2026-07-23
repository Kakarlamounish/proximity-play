-- Fixes a non-atomic invite-usage counter: the client previously did a
-- read-then-write (SELECT uses, then UPDATE uses = <value> + 1), which is a
-- classic race — two near-simultaneous joins via the same invite link can
-- both read the same value and both write +1, undercounting real usage and
-- allowing an invite to be used more times than max_uses permits. Found via
-- QA code review (BUG-010).
create or replace function public.increment_invite_uses(invite_code_param text)
returns int
language sql
security definer
set search_path = public
as $$
  update public.bubble_invites
  set uses = uses + 1
  where invite_code = invite_code_param
  returning uses;
$$;

grant execute on function public.increment_invite_uses(text) to authenticated;
