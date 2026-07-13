-- webauthn_credentials was missing the columns actually required to verify a
-- signature (public_key, counter is present but public_key/transports were
-- not) — without the public key there is no way to verify future assertions
-- against this credential, so the existing table could store a credential ID
-- but could never authenticate one.
ALTER TABLE public.webauthn_credentials
  ADD COLUMN IF NOT EXISTS public_key text,
  ADD COLUMN IF NOT EXISTS transports text[];

-- Registration/authentication ceremonies need a per-session, single-use
-- challenge stored server-side between the "options" and "verify" steps
-- (this is how WebAuthn prevents replay attacks). No such table existed.
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user_id ON public.webauthn_challenges(user_id);

ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Only the edge functions (using the service role key) read/write challenges;
-- clients never touch this table directly.
CREATE POLICY "service_role_only" ON public.webauthn_challenges
  FOR ALL TO service_role USING (true) WITH CHECK (true);
