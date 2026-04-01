
CREATE TABLE public.webauthn_credentials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL,
  name text NOT NULL DEFAULT 'Device',
  type text NOT NULL DEFAULT 'fingerprint',
  counter integer NOT NULL DEFAULT 0,
  last_used timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, credential_id)
);

ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credentials"
ON public.webauthn_credentials FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credentials"
ON public.webauthn_credentials FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials"
ON public.webauthn_credentials FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials"
ON public.webauthn_credentials FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
