// Mocks for the 5 Supabase Edge Functions the client actually invokes.
// These never throw / never reject — same contract as the real
// `supabase.functions.invoke()`, which resolves with `{ data: null, error }`
// on failure rather than rejecting.
import { db, authState } from './state';
import { fillInsertDefaults } from './query';
import { runtimeId } from './prng';

interface InvokeResult<T = any> {
  data: T | null;
  error: { message: string; context?: unknown } | null;
}

function fakeChallenge(): string {
  // Base64url-ish random-looking but deterministic-enough placeholder; the
  // actual WebAuthn ceremony can't be faked from here regardless of what we
  // return (see BiometricAuth.tsx / MOCK_BACKEND.md), so this just needs to
  // be a plausible string, not a real cryptographic challenge.
  return runtimeId().replace(/-/g, '');
}

function webauthnRegisterOptions(body: { username?: string }): InvokeResult {
  const uid = authState.currentUserId ?? 'anonymous';
  return {
    data: {
      rp: { name: 'Proximity Play (mock)', id: typeof window !== 'undefined' ? window.location.hostname : 'localhost' },
      user: { id: uid, name: body?.username ?? 'user', displayName: body?.username ?? 'user' },
      challenge: fakeChallenge(),
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      timeout: 60000,
      attestation: 'none',
      excludeCredentials: [],
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    },
    error: null,
  };
}

function webauthnRegisterVerify(body: { credential?: any }): InvokeResult {
  const uid = authState.currentUserId;
  if (uid && body?.credential) {
    const row = fillInsertDefaults('webauthn_credentials', {
      user_id: uid,
      credential_id: body.credential.id ?? runtimeId(),
      name: 'Mock authenticator',
      type: 'platform',
      public_key: null,
      counter: 0,
      transports: body.credential.response?.transports ?? [],
      last_used: null,
    });
    db.putRaw('webauthn_credentials', row);
  }
  return { data: { verified: true }, error: null };
}

function webauthnAuthenticateOptions(): InvokeResult {
  const uid = authState.currentUserId;
  const creds = uid ? db.all('webauthn_credentials').filter((c) => c.user_id === uid) : [];
  return {
    data: {
      challenge: fakeChallenge(),
      timeout: 60000,
      userVerification: 'preferred',
      allowCredentials: creds.map((c) => ({ id: c.credential_id, type: 'public-key', transports: c.transports ?? [] })),
    },
    error: null,
  };
}

function webauthnAuthenticateVerify(body: { credential?: any }): InvokeResult {
  const uid = authState.currentUserId;
  if (uid && body?.credential?.id) {
    const match = db.all('webauthn_credentials').find((c) => c.user_id === uid && c.credential_id === body.credential.id);
    if (match) {
      db.updateRaw('webauthn_credentials', match.id, { counter: (match.counter ?? 0) + 1, last_used: new Date().toISOString() });
    }
  }
  return { data: { verified: true }, error: null };
}

function redeemReferral(body: { code?: string }): InvokeResult {
  const code = body?.code?.trim();
  const uid = authState.currentUserId;
  if (!code) return { data: { success: false, error: 'Missing referral code' }, error: null };

  const referrer = db.all('profiles').find((p) => p.referral_code && p.referral_code === code);
  if (!referrer) {
    return { data: { success: false, error: 'Invalid or expired referral code' }, error: null };
  }
  if (referrer.id === uid) {
    return { data: { success: false, error: 'You cannot redeem your own referral code' }, error: null };
  }

  const currentUser = uid ? db.get('profiles', uid) : undefined;
  const existing = db.all('referrals').find((r) => r.referrer_id === referrer.id && r.referred_user_id === uid);
  if (existing) {
    return { data: { success: true }, error: null };
  }

  const row = fillInsertDefaults('referrals', {
    referrer_id: referrer.id,
    referred_email: currentUser ? `${currentUser.first_name.toLowerCase()}@example.test` : 'unknown@example.test',
    referred_user_id: uid,
    status: 'signed_up',
    activated_at: null,
  });
  db.putRaw('referrals', row);

  return { data: { success: true }, error: null };
}

const HANDLERS: Record<string, (body: any) => InvokeResult> = {
  'webauthn-register-options': webauthnRegisterOptions,
  'webauthn-register-verify': webauthnRegisterVerify,
  'webauthn-authenticate-options': webauthnAuthenticateOptions,
  'webauthn-authenticate-verify': webauthnAuthenticateVerify,
  'redeem-referral': redeemReferral,
};

export const mockFunctions = {
  async invoke(name: string, options?: { body?: any }): Promise<InvokeResult> {
    const handler = HANDLERS[name];
    if (!handler) {
      console.warn(`[mock-backend] supabase.functions.invoke("${name}") has no mock handler; returning an error.`);
      return { data: null, error: { message: `No mock handler registered for edge function "${name}"` } };
    }
    try {
      return handler(options?.body ?? {});
    } catch (e: any) {
      return { data: null, error: { message: e?.message ?? 'Mock edge function error' } };
    }
  },
};
