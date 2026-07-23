// Reimplementation, in plain JS, of the effective row-level-security policies
// that the real (hosted) Supabase project enforces via Postgres RLS. There is
// no Postgres here, so every `.from(table)` query in db/query.ts calls into
// this module to decide which rows a given (mock) authenticated user may
// see/insert/update/delete.
//
// These rules were derived from: (a) the explicit scoping rules the task
// spec called out per table, and (b) reading every call site under src/ to
// infer the shape of policies that would make those call sites behave
// sensibly (e.g. a bubble chat message must be readable by every member of
// that bubble, not just sender/recipient). Where the spec was silent, we
// default to "public read, own write" per the task's own guidance, and note
// the judgment call in comments below and in MOCK_BACKEND.md.
import { db, Row } from './state';

export type RlsRule = (row: Row, uid: string | null) => boolean;

export interface TableRls {
  read: RlsRule;
  insert: RlsRule;
  update: RlsRule;
  delete: RlsRule;
  /** Optional per-row transform applied to rows that pass the read rule (e.g. ghost-mode location masking). */
  mask?: (row: Row, uid: string | null) => Row;
}

export const publicRead: RlsRule = () => true;
export const denyAll: RlsRule = () => false;
export const authedOnly: RlsRule = (_row, uid) => uid != null;

export const ownerEquals = (col: string): RlsRule => (row, uid) => uid != null && row[col] === uid;

export const anyOwnerEquals = (...cols: string[]): RlsRule => (row, uid) =>
  uid != null && cols.some((c) => row[c] === uid);

/** True if `uid` is a member of the bubble referenced by row[bubbleCol]. */
const isBubbleMember = (bubbleCol: string): RlsRule => (row, uid) => {
  if (uid == null) return false;
  const bubbleId = row[bubbleCol];
  if (!bubbleId) return false;
  return db.all('bubble_memberships').some((m) => m.bubble_id === bubbleId && m.user_id === uid);
};

const or = (...rules: RlsRule[]): RlsRule => (row, uid) => rules.some((r) => r(row, uid));

// Messages: readable by sender, recipient, or (for bubble chat rows) any
// current member of that bubble — mirrors what ChatWindow/FriendChatWindow
// actually need to render a conversation.
const messagesRead = or(anyOwnerEquals('sender_id', 'recipient_id'), isBubbleMember('bubble_id'));
const callLogsRead = or(anyOwnerEquals('caller_id', 'receiver_id'), isBubbleMember('bubble_id'));

const profileMask = (row: Row, uid: string | null): Row => {
  if (row.ghost_mode && row.id !== uid) {
    return { ...row, latitude: null, longitude: null };
  }
  return row;
};

const DEFAULT_OWNER_COLUMNS = ['user_id', 'created_by', 'creator_id', 'owner_id', 'sender_id', 'reporter_id', 'blocker_id'];

function defaultRuleFor(table: string): TableRls {
  return {
    read: publicRead,
    insert: (row, uid) => {
      if (uid == null) return false;
      const col = DEFAULT_OWNER_COLUMNS.find((c) => row[c] !== undefined);
      return col ? row[col] === uid : true;
    },
    update: (row, uid) => {
      if (uid == null) return false;
      const col = DEFAULT_OWNER_COLUMNS.find((c) => row[c] !== undefined);
      return col ? row[col] === uid : false;
    },
    delete: (row, uid) => {
      if (uid == null) return false;
      const col = DEFAULT_OWNER_COLUMNS.find((c) => row[c] !== undefined);
      return col ? row[col] === uid : false;
    },
  };
}

const TABLE_RLS: Record<string, TableRls> = {
  profiles: {
    read: publicRead,
    insert: ownerEquals('id'),
    update: ownerEquals('id'),
    delete: denyAll,
    mask: profileMask,
  },
  bubble_memberships: {
    read: publicRead,
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: ownerEquals('user_id'),
  },
  bubbles: {
    read: publicRead,
    insert: authedOnly,
    update: ownerEquals('creator_id'),
    delete: ownerEquals('creator_id'),
  },
  // Judgment call: friendships have no direct-insert call sites in the app —
  // they're only ever created as the side effect of accepting a friend
  // request (replicated in query.ts), so direct client inserts are denied.
  friendships: {
    read: anyOwnerEquals('user_id_1', 'user_id_2'),
    insert: denyAll,
    update: denyAll,
    delete: anyOwnerEquals('user_id_1', 'user_id_2'),
  },
  friend_requests: {
    read: anyOwnerEquals('sender_id', 'receiver_id'),
    insert: ownerEquals('sender_id'),
    update: anyOwnerEquals('sender_id', 'receiver_id'),
    delete: anyOwnerEquals('sender_id', 'receiver_id'),
  },
  notifications: {
    read: ownerEquals('user_id'),
    // Judgment call: notifications are routinely created by OTHER users'
    // actions (e.g. accepting your friend request creates a notification
    // for you), so insert can't require row.user_id === uid. Any
    // authenticated user may insert a notification for anybody, matching
    // typical "insert with check (true)" notification policies.
    insert: authedOnly,
    update: ownerEquals('user_id'),
    delete: ownerEquals('user_id'),
  },
  messages: {
    read: messagesRead,
    insert: ownerEquals('sender_id'),
    update: anyOwnerEquals('sender_id', 'recipient_id'),
    delete: ownerEquals('sender_id'),
  },
  call_logs: {
    read: callLogsRead,
    insert: ownerEquals('caller_id'),
    update: anyOwnerEquals('caller_id', 'receiver_id'),
    delete: denyAll,
  },
  dead_drops: {
    // Matches real app behavior: fetchMyDrops() selects with no owner
    // filter at all, so read is effectively unrestricted (nearby-drop
    // discovery via the RPC needs this anyway).
    read: publicRead,
    insert: ownerEquals('created_by'),
    // markAsViewed() is called by whichever user *finds* the drop, not its
    // creator, so update can't be owner-only.
    update: authedOnly,
    delete: ownerEquals('created_by'),
  },
  location_stories: {
    read: publicRead,
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: ownerEquals('user_id'),
  },
  story_reactions: {
    read: publicRead,
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: ownerEquals('user_id'),
  },
  story_views: {
    read: publicRead,
    insert: ownerEquals('viewer_id'),
    update: denyAll,
    delete: denyAll,
  },
  story_comments: {
    read: publicRead,
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: ownerEquals('user_id'),
  },
  user_badges: {
    read: publicRead,
    insert: ownerEquals('user_id'),
    update: denyAll,
    delete: denyAll,
  },
  badges: {
    read: publicRead,
    insert: authedOnly,
    update: denyAll,
    delete: denyAll,
  },
  snap_scores: {
    read: publicRead,
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: denyAll,
  },
  snap_streaks: {
    read: anyOwnerEquals('user_id_1', 'user_id_2'),
    insert: authedOnly,
    update: anyOwnerEquals('user_id_1', 'user_id_2'),
    delete: denyAll,
  },
  trips: {
    read: (row, uid) => uid != null && (row.created_by === uid || (Array.isArray(row.shared_with) && row.shared_with.includes(uid))),
    insert: ownerEquals('created_by'),
    update: ownerEquals('created_by'),
    delete: ownerEquals('created_by'),
  },
  bubble_invites: {
    read: publicRead,
    insert: ownerEquals('created_by'),
    // Judgment call: the invite `uses` counter is bumped by the *joining*
    // user (see JoinBubble.tsx), not the creator, so update can't be
    // owner-only.
    update: authedOnly,
    delete: ownerEquals('created_by'),
  },
  meetups: {
    read: publicRead,
    insert: ownerEquals('organizer_id'),
    update: ownerEquals('organizer_id'),
    delete: ownerEquals('organizer_id'),
  },
  meetup_rsvps: {
    read: publicRead,
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: ownerEquals('user_id'),
  },
  user_avatars: {
    read: publicRead,
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: denyAll,
  },
  referrals: {
    read: ownerEquals('referrer_id'),
    insert: ownerEquals('referrer_id'),
    update: ownerEquals('referrer_id'),
    delete: denyAll,
  },
  webauthn_credentials: {
    read: ownerEquals('user_id'),
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: ownerEquals('user_id'),
  },
  webauthn_challenges: {
    read: ownerEquals('user_id'),
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: ownerEquals('user_id'),
  },
  voice_messages: {
    // Judgment call: chat_id may be a DM pair or a bubble id, and the
    // recipient (not just the sender) needs read/update (markAsPlayed) —
    // default to public read / any-authenticated-user write, per the task's
    // fallback guidance for ambiguous tables.
    read: publicRead,
    insert: ownerEquals('sender_id'),
    update: authedOnly,
    delete: ownerEquals('sender_id'),
  },
  user_presence: {
    read: publicRead,
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: ownerEquals('user_id'),
  },
  user_blocks: {
    read: ownerEquals('blocker_id'),
    insert: ownerEquals('blocker_id'),
    update: denyAll,
    delete: ownerEquals('blocker_id'),
  },
  user_reports: {
    read: ownerEquals('reporter_id'),
    insert: ownerEquals('reporter_id'),
    update: denyAll,
    delete: denyAll,
  },
  push_subscriptions: {
    read: ownerEquals('user_id'),
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: ownerEquals('user_id'),
  },
  privacy_schedules: {
    read: ownerEquals('user_id'),
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: ownerEquals('user_id'),
  },
  live_locations: {
    read: publicRead,
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: ownerEquals('user_id'),
  },
  status_updates: {
    read: publicRead,
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: ownerEquals('user_id'),
  },
  status_reactions: {
    read: publicRead,
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: ownerEquals('user_id'),
  },
  safety_alerts: {
    read: ownerEquals('user_id'),
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: denyAll,
  },
  activities: {
    read: publicRead,
    insert: ownerEquals('user_id'),
    update: denyAll,
    delete: denyAll,
  },
  hangout_zones: {
    read: publicRead,
    insert: ownerEquals('created_by'),
    update: ownerEquals('created_by'),
    delete: ownerEquals('created_by'),
  },
  location_history: {
    read: ownerEquals('user_id'),
    insert: ownerEquals('user_id'),
    update: denyAll,
    delete: ownerEquals('user_id'),
  },
  geofences: {
    read: ownerEquals('user_id'),
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: ownerEquals('user_id'),
  },
  // Not present in generated types.ts (catalog flagged these as real,
  // actively-queried tables missing from codegen).
  ar_pins: {
    read: publicRead,
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: ownerEquals('user_id'),
  },
  emergency_shares: {
    // Judgment call: real feature likely lets "trusted contacts" read an
    // emergency share, but no trusted-contacts table/relationship exists
    // anywhere in the client code, so we can't derive that scoping. Default
    // to owner-only read per the fallback rule.
    read: ownerEquals('user_id'),
    insert: ownerEquals('user_id'),
    update: ownerEquals('user_id'),
    delete: ownerEquals('user_id'),
  },
};

export function rlsFor(table: string): TableRls {
  return TABLE_RLS[table] ?? defaultRuleFor(table);
}
