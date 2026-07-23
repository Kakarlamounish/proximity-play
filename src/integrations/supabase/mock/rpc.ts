// Mock implementations of the two read-only Postgres RPCs the client calls.
// Both are security-definer functions in the real project (they bypass RLS
// server-side to compute a cross-user result), so these mocks intentionally
// read the raw table state directly rather than going through query.ts's
// row-level-security filtering.
import { db, Row } from './state';
import { PostgrestError } from './query';

function err(message: string, code = 'MOCK_ERROR'): PostgrestError {
  return { message, details: '', hint: '', code };
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * get_friend_locations(): friends' locations, respecting ghost_mode.
 *
 * Judgment call: "respect ghost_mode" could mean either nulling out a ghost
 * friend's coordinates or omitting them from the result entirely. We omit
 * the row entirely — ghost mode is meant to make a user invisible on
 * friends' maps, and a row with null lat/lng would still show up in list
 * UIs that don't check for that. This is documented in MOCK_BACKEND.md.
 */
export function rpcGetFriendLocations(currentUserId: string | null): { data: Row[] | null; error: PostgrestError | null } {
  if (!currentUserId) return { data: [], error: null };

  const friendships = db.all('friendships').filter((f) => f.user_id_1 === currentUserId || f.user_id_2 === currentUserId);
  const friendIds = new Set(
    friendships.map((f) => (f.user_id_1 === currentUserId ? f.user_id_2 : f.user_id_1))
  );

  const rows = db
    .all('profiles')
    .filter((p) => friendIds.has(p.id))
    .filter((p) => !p.ghost_mode)
    .map((p) => ({
      id: p.id,
      first_name: p.first_name,
      ghost_mode: p.ghost_mode,
      latitude: p.latitude,
      longitude: p.longitude,
      profile_photo_url: p.profile_photo_url,
    }));

  return { data: rows, error: null };
}

/**
 * increment_invite_uses(invite_code_param): atomic +1 on bubble_invites.uses,
 * mirroring the real Postgres function added in
 * supabase/migrations/20260721000001_atomic_invite_uses_increment.sql
 * (BUG-010 — replaces a client-side read-then-write race).
 */
export function rpcIncrementInviteUses(args: { invite_code_param?: string }): { data: number | null; error: PostgrestError | null } {
  const code = args?.invite_code_param;
  if (!code) return { data: null, error: err('invite_code_param is required', 'MOCK_BAD_ARGS') };

  const invite = db.all('bubble_invites').find((r) => r.invite_code === code);
  if (!invite) return { data: null, error: err('invite not found', 'MOCK_NOT_FOUND') };

  const updated = db.updateRaw('bubble_invites', invite.id, { uses: (invite.uses || 0) + 1 });
  return { data: updated?.uses ?? null, error: null };
}

/**
 * is_blocked(user_a, user_b): mirrors the real security-definer function in
 * supabase/migrations/20260722000001_is_blocked_rpc.sql (BUG-018). Reads
 * user_blocks directly (bypassing RLS) so either party can check the block
 * relationship regardless of who's the blocker — real RLS on this table
 * only lets the blocker read their own rows.
 */
export function rpcIsBlocked(args: { user_a?: string; user_b?: string }): { data: boolean | null; error: PostgrestError | null } {
  const { user_a, user_b } = args || {};
  if (!user_a || !user_b) return { data: null, error: err('user_a and user_b are required', 'MOCK_BAD_ARGS') };

  const blocked = db.all('user_blocks').some(
    (r) => (r.blocker_id === user_a && r.blocked_id === user_b) || (r.blocker_id === user_b && r.blocked_id === user_a)
  );
  return { data: blocked, error: null };
}

/**
 * get_nearby_dead_drops(user_lat, user_lng): dead drops within their own
 * `radius` of the caller's location, excluding expired ones.
 */
export function rpcGetNearbyDeadDrops(args: { user_lat?: number; user_lng?: number }): { data: Row[] | null; error: PostgrestError | null } {
  const lat = Number(args?.user_lat);
  const lng = Number(args?.user_lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return { data: null, error: err('user_lat and user_lng are required numbers', 'MOCK_BAD_ARGS') };
  }

  const now = Date.now();
  const rows = db.all('dead_drops').filter((d) => {
    if (d.expires_at && new Date(d.expires_at).getTime() < now) return false;
    const distance = haversineMeters(lat, lng, Number(d.latitude), Number(d.longitude));
    return distance <= Number(d.radius ?? 100);
  });

  return { data: rows, error: null };
}
