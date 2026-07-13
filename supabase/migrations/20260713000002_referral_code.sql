-- Referrals table already existed but had nowhere to store a stable,
-- shareable per-user code — useReferralStore.generateCode() only produced an
-- ephemeral in-memory string that was never persisted or look-up-able,
-- so no share link could ever actually be redeemed.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
