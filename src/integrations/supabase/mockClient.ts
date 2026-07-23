// Client-side-only mock of the Supabase client, used for local QA testing
// with zero real network calls. See MOCK_BACKEND.md at the repo root for
// how to enable it, the seeded test account credentials, and known
// limitations.
//
// This file is swapped in for `src/integrations/supabase/client.ts` via a
// Vite resolve alias (see vite.config.ts) that only activates when
// VITE_USE_MOCK_BACKEND=true — the real client.ts is never modified and the
// 73 call sites that `import { supabase } from '@/integrations/supabase/client'`
// don't need to change at all.
//
// Implementation lives in ./mock/*: state.ts (in-memory tables + change bus),
// query.ts (chainable query builder + RLS-aware execution), rls.ts (per-table
// row-level-security reimplementation), auth.ts, storage.ts, realtime.ts,
// functions.ts (edge function mocks), rpc.ts (the two Postgres RPCs), and
// seed.ts (deterministic fixture data).
import { authState } from './mock/state';
import { MockQueryBuilder, PostgrestError } from './mock/query';
import { mockAuth } from './mock/auth';
import { mockStorage } from './mock/storage';
import { mockFunctions } from './mock/functions';
import { mockChannel, mockRemoveChannel, mockGetChannels } from './mock/realtime';
import { rpcGetFriendLocations, rpcGetNearbyDeadDrops, rpcIncrementInviteUses, rpcIsBlocked } from './mock/rpc';
import { seedMockBackend, TEST_ACCOUNT_EMAIL, TEST_ACCOUNT_PASSWORD } from './mock/seed';

seedMockBackend();

console.info(
  `%c[mock-backend] Enabled — no real network calls will be made.\n` +
    `Test account: ${TEST_ACCOUNT_EMAIL} / ${TEST_ACCOUNT_PASSWORD}\n` +
    'See MOCK_BACKEND.md for details and known limitations.',
  'color: #34D399; font-weight: bold;'
);

function currentUserId(): string | null {
  return authState.currentUserId;
}

function mockRpc(fn: string, args?: Record<string, any>): Promise<{ data: any; error: PostgrestError | null }> {
  switch (fn) {
    case 'get_friend_locations':
      return Promise.resolve(rpcGetFriendLocations(currentUserId()));
    case 'get_nearby_dead_drops':
      return Promise.resolve(rpcGetNearbyDeadDrops(args ?? {}));
    case 'increment_invite_uses':
      return Promise.resolve(rpcIncrementInviteUses(args ?? {}));
    case 'is_blocked':
      return Promise.resolve(rpcIsBlocked(args ?? {}));
    default:
      console.warn(`[mock-backend] supabase.rpc("${fn}") has no mock implementation.`);
      return Promise.resolve({
        data: null,
        error: { message: `No mock implementation for RPC "${fn}"`, details: '', hint: '', code: 'MOCK_ERROR' },
      });
  }
}

export const supabase = {
  auth: mockAuth,
  from(table: string) {
    return new MockQueryBuilder(table, currentUserId);
  },
  rpc: mockRpc,
  storage: mockStorage,
  functions: mockFunctions,
  channel: mockChannel,
  removeChannel: mockRemoveChannel,
  getChannels: mockGetChannels,
};

export type { PostgrestError };
