// In-memory reimplementation of the slice of supabase-js's GoTrue auth
// client that the app actually calls (see AuthContext.tsx, Auth.tsx,
// ProfileSetup.tsx, and the various components that call getUser()).
//
// Known, documented limitations (see MOCK_BACKEND.md):
//  - signInWithOAuth('google') cannot be faked (no real redirect flow to
//    intercept), so it resolves with an error and logs a console warning.
//  - Email confirmation is skipped entirely: signUp immediately establishes
//    a session, which is a deliberate deviation from the real project so a
//    QA tester can create an account and start using the app in one step.
import { db, authState, Row } from './state';
import { runtimeId } from './prng';

export interface MockUser {
  id: string;
  aud: string;
  role: string;
  email: string;
  email_confirmed_at: string;
  phone: string;
  confirmed_at: string;
  last_sign_in_at: string;
  app_metadata: { provider: string; providers: string[] };
  user_metadata: Record<string, any>;
  identities: any[];
  created_at: string;
  updated_at: string;
}

export interface MockSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user: MockUser;
}

interface Account {
  email: string;
  password: string;
  user: MockUser;
}

export interface AuthError {
  message: string;
  status?: number;
  name: string;
}

function authError(message: string, status = 400): AuthError {
  return { message, status, name: 'AuthApiError' };
}

const accounts = new Map<string, Account>(); // keyed by lowercase email

// Real supabase-js persists the session in localStorage so a full page
// reload (or a tester typing a URL directly / hitting refresh) doesn't log
// the user out. The mock replicates that for the same reason: without it,
// every direct navigation would look like "not logged in" and testing a
// deployed-app-like flow would be impossible. Only the session pointer is
// persisted here (not the whole in-memory DB) — restoring only works
// cleanly for accounts that also exist after `seedMockBackend()` reseeds on
// the next load, i.e. the well-known seeded test account. A custom account
// created via signUp during a session will not survive a hard reload since
// nothing re-creates it; this is a documented mock limitation, not a real
// app bug (see MOCK_BACKEND.md).
const SESSION_STORAGE_KEY = 'mock-backend:session';

function loadPersistedSession(): MockSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MockSession) : null;
  } catch {
    return null;
  }
}

function persistSession(session: MockSession | null): void {
  try {
    if (session) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // private-browsing / storage disabled — session simply won't survive a reload.
  }
}

let currentSession: MockSession | null = loadPersistedSession();
// Restoring a session before `accounts`/`db` seeding has happened is fine —
// seedAccount()/seedMockBackend() run synchronously at module load, before
// any consumer can call getSession()/onAuthStateChange.
authState.currentUserId = currentSession?.user.id ?? null;

type AuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED';
type AuthListener = (event: AuthEvent, session: MockSession | null) => void;
const listeners = new Set<AuthListener>();

function emit(event: AuthEvent, session: MockSession | null): void {
  for (const fn of listeners) {
    try {
      fn(event, session);
    } catch (e) {
      console.error('[mock-backend] onAuthStateChange listener threw:', e);
    }
  }
}

export function makeUser(email: string, metadata: Record<string, any>, id?: string): MockUser {
  const now = new Date().toISOString();
  return {
    id: id ?? runtimeId(),
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: now,
    phone: '',
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: metadata,
    identities: [],
    created_at: now,
    updated_at: now,
  };
}

function makeSession(user: MockUser): MockSession {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    access_token: `mock-access-token-${user.id}`,
    refresh_token: `mock-refresh-token-${user.id}`,
    expires_in: 3600,
    expires_at: nowSeconds + 3600,
    token_type: 'bearer',
    user,
  };
}

function setSession(session: MockSession | null, event: AuthEvent): void {
  currentSession = session;
  authState.currentUserId = session?.user.id ?? null;
  persistSession(session);
  emit(event, session);
}

/** Seeds an account without going through signUp's side effects — used by seed.ts for the well-known test account. */
export function seedAccount(email: string, password: string, user: MockUser): void {
  accounts.set(email.toLowerCase(), { email: email.toLowerCase(), password, user });
}

function ensureProfileRow(user: MockUser, fullName: string): void {
  if (db.get('profiles', user.id)) return;
  const firstName = fullName?.trim() || user.email.split('@')[0];
  db.putRaw('profiles', {
    id: user.id,
    first_name: firstName || 'New User',
    age: 25,
    bio: null,
    gender: null,
    ghost_mode: false,
    interests: [],
    latitude: null,
    longitude: null,
    location_updated_at: null,
    profile_photo_url: null,
    referral_code: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export const mockAuth = {
  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, any> } }) {
    const key = email?.toLowerCase();
    if (!key || !password) {
      return { data: { user: null, session: null }, error: authError('Email and password are required') };
    }
    if (accounts.has(key)) {
      return { data: { user: null, session: null }, error: authError('User already registered', 422) };
    }
    const metadata = options?.data ?? {};
    const user = makeUser(key, metadata);
    accounts.set(key, { email: key, password, user });
    ensureProfileRow(user, metadata.full_name ?? '');

    // Deliberately skips email confirmation — see module doc comment.
    const session = makeSession(user);
    setSession(session, 'SIGNED_IN');

    return { data: { user, session }, error: null };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const key = email?.toLowerCase();
    const account = key ? accounts.get(key) : undefined;
    if (!account || account.password !== password) {
      return { data: { user: null, session: null }, error: authError('Invalid login credentials') };
    }
    const session = makeSession(account.user);
    setSession(session, 'SIGNED_IN');
    return { data: { user: account.user, session }, error: null };
  },

  async signInWithOAuth({ provider }: { provider: string; options?: Record<string, any> }) {
    console.warn(
      `[mock-backend] signInWithOAuth('${provider}') is not supported — OAuth requires a real redirect ` +
        'round-trip that cannot be faked client-side. Use email/password sign-in instead.'
    );
    return {
      data: { provider, url: null },
      error: authError(`OAuth sign-in ("${provider}") is not supported in the mock backend. Please use email/password.`),
    };
  },

  async signOut() {
    setSession(null, 'SIGNED_OUT');
    return { error: null };
  },

  async getSession() {
    return { data: { session: currentSession }, error: null };
  },

  async getUser() {
    return { data: { user: currentSession?.user ?? null }, error: null };
  },

  onAuthStateChange(callback: AuthListener) {
    listeners.add(callback);
    // Mirrors real supabase-js: fires an initial event on the next tick after subscribing.
    Promise.resolve().then(() => {
      if (listeners.has(callback)) callback('INITIAL_SESSION', currentSession);
    });
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            listeners.delete(callback);
          },
        },
      },
    };
  },
};

export function resetMockAuth(): void {
  accounts.clear();
  currentSession = null;
  authState.currentUserId = null;
  persistSession(null);
}
