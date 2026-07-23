// The chainable query-builder subset of postgrest-js/supabase-js that the
// app actually uses (see the task brief's "Query builder surface to
// support"), backed by the in-memory store in state.ts and the RLS
// reimplementation in rls.ts.
//
// Every terminal `await` resolves to `{ data, error, count? }` and NEVER
// throws — errors are returned supabase-js style as
// `{ message, details, hint, code }`, matching real client behavior so
// existing `if (error) throw error` call sites keep working.
import { db, Row } from './state';
import { rlsFor } from './rls';
import { runtimeId } from './prng';

export interface PostgrestError {
  message: string;
  details: string;
  hint: string;
  code: string;
}

export interface MockResult<T = any> {
  data: T | null;
  error: PostgrestError | null;
  count?: number | null;
  status: number;
  statusText: string;
}

type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in' | 'cs';

interface FilterCond {
  column: string;
  op: FilterOp;
  value: any;
  negate?: boolean;
}

type Predicate = (row: Row) => boolean;

function err(message: string, code = 'MOCK_ERROR', details = '', hint = ''): PostgrestError {
  return { message, details, hint, code };
}

// ---------------------------------------------------------------------------
// value comparison helpers
// ---------------------------------------------------------------------------

function looksLikeDate(v: any): boolean {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v));
}

function valuesEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return Boolean(a) === (b === 'true' || b === true || b === 1);
  }
  if (typeof a === 'number' || typeof b === 'number') {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  }
  return String(a) === String(b);
}

function compareOrdered(a: any, b: any): number {
  if (a == null && b == null) return 0;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (looksLikeDate(a) && looksLikeDate(b)) return Date.parse(a) - Date.parse(b);
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && a !== '' && b !== '') return na - nb;
  return String(a).localeCompare(String(b));
}

function parseBraceArray(raw: string): string[] {
  const trimmed = raw.trim().replace(/^\{/, '').replace(/\}$/, '');
  if (trimmed === '') return [];
  return trimmed.split(',').map((s) => s.trim());
}

function applyOp(rowVal: any, op: string, rawValue: any): boolean {
  switch (op) {
    case 'eq':
      return valuesEqual(rowVal, rawValue);
    case 'neq':
      return !valuesEqual(rowVal, rawValue);
    case 'gt':
      return compareOrdered(rowVal, rawValue) > 0;
    case 'gte':
      return compareOrdered(rowVal, rawValue) >= 0;
    case 'lt':
      return compareOrdered(rowVal, rawValue) < 0;
    case 'lte':
      return compareOrdered(rowVal, rawValue) <= 0;
    case 'is':
      if (rawValue === null || rawValue === 'null') return rowVal === null || rowVal === undefined;
      if (rawValue === true || rawValue === 'true') return rowVal === true;
      if (rawValue === false || rawValue === 'false') return rowVal === false;
      return valuesEqual(rowVal, rawValue);
    case 'in': {
      const arr = Array.isArray(rawValue) ? rawValue : parseBraceArray(String(rawValue));
      return arr.some((v) => valuesEqual(rowVal, v));
    }
    case 'like':
    case 'ilike': {
      const pattern = String(rawValue)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/%/g, '.*')
        .replace(/_/g, '.');
      const re = new RegExp(`^${pattern}$`, op === 'ilike' ? 'i' : '');
      return typeof rowVal === 'string' && re.test(rowVal);
    }
    case 'cs': {
      const arr = Array.isArray(rawValue) ? rawValue : parseBraceArray(String(rawValue));
      return Array.isArray(rowVal) && arr.every((v) => rowVal.some((rv: any) => valuesEqual(rv, v)));
    }
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// `.or('col.op.val,and(col.op.val,col2.op2.val2)')` parsing
// ---------------------------------------------------------------------------

function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === sep && depth === 0) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

function parseCondString(cond: string): Predicate {
  const c = cond.trim();
  const firstDot = c.indexOf('.');
  const secondDot = c.indexOf('.', firstDot + 1);
  if (firstDot === -1 || secondDot === -1) return () => true;
  const column = c.slice(0, firstDot);
  const op = c.slice(firstDot + 1, secondDot);
  const value = c.slice(secondDot + 1);
  return (row: Row) => applyOp(row[column], op, value);
}

function parseOrExpression(expr: string): Predicate {
  const groups = splitTopLevel(expr, ',');
  const preds = groups.map((raw) => {
    const g = raw.trim();
    if (g.startsWith('and(') && g.endsWith(')')) {
      const inner = g.slice(4, -1);
      const conds = splitTopLevel(inner, ',').map(parseCondString);
      return (row: Row) => conds.every((c) => c(row));
    }
    return parseCondString(g);
  });
  return (row: Row) => preds.some((p) => p(row));
}

// ---------------------------------------------------------------------------
// insert defaults + upsert conflict keys + trigger-replication side effects
// ---------------------------------------------------------------------------

const INSERT_DEFAULTS: Record<string, Row> = {
  bubbles: { is_private: false, member_count: 1 },
  bubble_memberships: { role: 'member' },
  friend_requests: { status: 'pending' },
  notifications: { read: false },
  dead_drops: { viewed_by: [], radius: 100, max_views: null },
  webauthn_credentials: { counter: 0, type: 'platform', transports: [] },
  messages: { message_type: 'text', is_disappearing: false },
  bubble_invites: { uses: 0, max_uses: 50, is_active: true },
  trips: { status: 'pending', shared_with: [] },
  snap_scores: { snaps_sent: 0, snaps_received: 0, stories_posted: 0, total_score: 0 },
  snap_streaks: { streak_count: 1 },
  user_presence: { status: 'online' },
  voice_messages: { is_played: false },
  hangout_zones: { inside_user_ids: [] },
};

const UPSERT_CONFLICT_KEYS: Record<string, string[]> = {
  profiles: ['id'],
  privacy_schedules: ['user_id'],
  user_presence: ['user_id'],
  push_subscriptions: ['user_id', 'endpoint'],
  user_avatars: ['user_id'],
  status_updates: ['user_id', 'bubble_id'],
  live_locations: ['user_id', 'bubble_id'],
  story_reactions: ['story_id', 'user_id'],
};

const TIMESTAMPED_TABLES = new Set([
  'profiles', 'bubbles', 'bubble_memberships', 'messages', 'notifications', 'friend_requests',
  'friendships', 'call_logs', 'dead_drops', 'location_stories', 'story_reactions', 'story_views',
  'story_comments', 'user_badges', 'badges', 'snap_scores', 'snap_streaks', 'trips', 'bubble_invites',
  'meetups', 'meetup_rsvps', 'user_avatars', 'referrals', 'webauthn_credentials', 'webauthn_challenges',
  'voice_messages', 'user_presence', 'user_blocks', 'push_subscriptions', 'privacy_schedules',
  'live_locations', 'status_updates', 'status_reactions', 'safety_alerts', 'activities',
  'hangout_zones', 'location_history', 'geofences', 'ar_pins', 'emergency_shares',
]);

export function fillInsertDefaults(table: string, row: Row): Row {
  const base = INSERT_DEFAULTS[table] ? { ...INSERT_DEFAULTS[table] } : {};
  const merged: Row = { ...base, ...row };
  if (merged.id === undefined) merged.id = runtimeId();
  const now = new Date().toISOString();
  if (TIMESTAMPED_TABLES.has(table) && merged.created_at === undefined) merged.created_at = now;
  return merged;
}

/** Replicates DB triggers that the real project runs alongside plain writes. */
function runInsertSideEffects(table: string, row: Row): void {
  if (table === 'bubble_memberships') {
    const bubble = db.get('bubbles', row.bubble_id);
    if (bubble) db.updateRaw('bubbles', bubble.id, { member_count: (bubble.member_count ?? 0) + 1 });
  }
}

function runDeleteSideEffects(table: string, row: Row): void {
  if (table === 'bubble_memberships') {
    const bubble = db.get('bubbles', row.bubble_id);
    if (bubble) db.updateRaw('bubbles', bubble.id, { member_count: Math.max(0, (bubble.member_count ?? 1) - 1) });
  }
}

/** Replicates the `on_friend_request_accepted` trigger: accepting a request creates a friendship row. */
function runUpdateSideEffects(table: string, before: Row, after: Row): void {
  if (table === 'friend_requests' && after.status === 'accepted' && before.status !== 'accepted') {
    const a = after.sender_id;
    const b = after.receiver_id;
    const exists = db.all('friendships').some(
      (f) => (f.user_id_1 === a && f.user_id_2 === b) || (f.user_id_1 === b && f.user_id_2 === a)
    );
    if (!exists) {
      const friendship = fillInsertDefaults('friendships', { user_id_1: a, user_id_2: b });
      db.putRaw('friendships', friendship);
    }
  }
}

// ---------------------------------------------------------------------------
// projection / ordering
// ---------------------------------------------------------------------------

// Splits a select() column string on top-level commas only — commas inside
// an embedded-resource's own column list, e.g. "badge:badges(name, icon)",
// must not split that resource apart.
function splitTopLevelCols(cols: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of cols) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// Matches supabase-js's embedded-resource select syntax:
//   table(cols)                       e.g. bubbles(*)
//   alias:table(cols)                 e.g. badge:badges(*)
//   alias:table!fk_constraint(cols)   e.g. creator:profiles!bubbles_creator_id_fkey(first_name)
// Whitespace (including newlines) is allowed around the colon, the table
// name, the !fkey hint, and before the opening paren — real callers in this
// codebase format multi-line select strings like:
//   .select(`bubble_id, bubbles (\n  id,\n  name\n)`)
// which has a space before "(", not "bubbles(...)" — an earlier version of
// this regex required immediate adjacency and silently failed to match,
// leaving `bm.bubbles` undefined for every row (found via live QA testing:
// Messages.tsx's bubble list ended up with every bubble's `id` defaulting to
// `''` via `bm.bubbles?.id ?? ''`).
const EMBED_RE = /^(?:([\w]+)\s*:\s*)?([\w]+)\s*(?:!\s*([\w]+))?\s*\(([\s\S]*)\)$/;

// The mock has no real foreign-key metadata, so the join column is inferred:
// prefer parsing the postgrest `!table_column_fkey` hint (Postgres's default
// constraint-naming convention) when present, otherwise fall back to
// singularizing the alias/table name and appending "_id" — which matches
// this schema's own naming convention (badge:badges -> badge_id,
// bubbles(*) -> bubble_id, etc.) for every embed actually used in src/.
function inferFkColumn(sourceTable: string, alias: string, fkeyHint?: string): string {
  if (fkeyHint) {
    const prefix = `${sourceTable}_`;
    const suffix = '_fkey';
    if (fkeyHint.startsWith(prefix) && fkeyHint.endsWith(suffix)) {
      return fkeyHint.slice(prefix.length, fkeyHint.length - suffix.length);
    }
  }
  const singular = alias.endsWith('ies') ? `${alias.slice(0, -3)}y` : alias.endsWith('s') ? alias.slice(0, -1) : alias;
  return `${singular}_id`;
}

function projectCols(rows: Row[], cols: string | null, sourceTable: string): Row[] {
  if (!cols || cols.trim() === '*' || cols.trim() === '') return rows;
  const tokens = splitTopLevelCols(cols);
  const plainCols: string[] = [];
  const embeds: { alias: string; table: string; fkeyHint?: string; nestedCols: string }[] = [];
  let hasWildcard = false;

  for (const token of tokens) {
    if (token === '*') {
      hasWildcard = true;
      continue;
    }
    const match = token.match(EMBED_RE);
    if (match) {
      const [, aliasRaw, table, fkeyHint, nestedCols] = match;
      embeds.push({ alias: aliasRaw || table, table, fkeyHint, nestedCols });
    } else {
      plainCols.push(token.split(':').pop()!.trim());
    }
  }

  if (embeds.length === 0) {
    if (hasWildcard) return rows;
    return rows.map((row) => {
      const out: Row = {};
      for (const name of plainCols) out[name] = row[name];
      return out;
    });
  }

  return rows.map((row) => {
    const out: Row = hasWildcard ? { ...row } : {};
    if (!hasWildcard) for (const name of plainCols) out[name] = row[name];
    for (const embed of embeds) {
      const fkColumn = inferFkColumn(sourceTable, embed.alias, embed.fkeyHint);
      const fkValue = row[fkColumn];
      const joinedRow = fkValue != null ? db.get(embed.table, fkValue) : undefined;
      out[embed.alias] = joinedRow ? projectCols([joinedRow], embed.nestedCols, embed.table)[0] : null;
    }
    return out;
  });
}

interface OrderSpec {
  column: string;
  ascending: boolean;
}

function multiSort(rows: Row[], orders: OrderSpec[]): Row[] {
  if (!orders.length) return rows;
  return [...rows].sort((a, b) => {
    for (const { column, ascending } of orders) {
      let cmp = compareOrdered(a[column], b[column]);
      if (a[column] == null && b[column] != null) cmp = 1;
      if (a[column] != null && b[column] == null) cmp = -1;
      if (!ascending) cmp = -cmp;
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

// ---------------------------------------------------------------------------
// The query builder
// ---------------------------------------------------------------------------

type OpType = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

export class MockQueryBuilder<T = any> implements PromiseLike<MockResult<T>> {
  private opType: OpType | null = null;
  private payload: Row | Row[] | null = null;
  private upsertOptions: { onConflict?: string } = {};
  private filters: FilterCond[] = [];
  private orPredicates: Predicate[] = [];
  private selectCols: string | null = null;
  private wantSelect = false;
  private countMode: 'exact' | 'planned' | 'estimated' | null = null;
  private orders: OrderSpec[] = [];
  private limitN: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private singleMode: 'single' | 'maybeSingle' | null = null;

  constructor(private readonly table: string, private readonly currentUserId: () => string | null) {}

  select(cols?: string, opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): this {
    if (opts?.count) this.countMode = opts.count;
    if (this.opType === null) {
      this.opType = 'select';
      this.selectCols = cols ?? '*';
    } else {
      this.wantSelect = true;
      this.selectCols = cols ?? '*';
    }
    return this;
  }

  insert(values: Row | Row[]): this {
    this.opType = 'insert';
    this.payload = values;
    return this;
  }

  update(values: Row): this {
    this.opType = 'update';
    this.payload = values;
    return this;
  }

  upsert(values: Row | Row[], options?: { onConflict?: string }): this {
    this.opType = 'upsert';
    this.payload = values;
    this.upsertOptions = options ?? {};
    return this;
  }

  delete(): this {
    this.opType = 'delete';
    return this;
  }

  eq(column: string, value: any): this {
    this.filters.push({ column, op: 'eq', value });
    return this;
  }
  neq(column: string, value: any): this {
    this.filters.push({ column, op: 'neq', value });
    return this;
  }
  gt(column: string, value: any): this {
    this.filters.push({ column, op: 'gt', value });
    return this;
  }
  gte(column: string, value: any): this {
    this.filters.push({ column, op: 'gte', value });
    return this;
  }
  lt(column: string, value: any): this {
    this.filters.push({ column, op: 'lt', value });
    return this;
  }
  lte(column: string, value: any): this {
    this.filters.push({ column, op: 'lte', value });
    return this;
  }
  like(column: string, value: any): this {
    this.filters.push({ column, op: 'like', value });
    return this;
  }
  ilike(column: string, value: any): this {
    this.filters.push({ column, op: 'ilike', value });
    return this;
  }
  is(column: string, value: any): this {
    this.filters.push({ column, op: 'is', value });
    return this;
  }
  in(column: string, values: any[]): this {
    this.filters.push({ column, op: 'in', value: values });
    return this;
  }
  contains(column: string, value: any): this {
    this.filters.push({ column, op: 'cs', value });
    return this;
  }
  // supabase-js's `.not(column, operator, value)` — negates whichever
  // operator is passed (e.g. `.not('latitude', 'is', null)` means "latitude
  // is not null"). Added after live QA testing found Discover.tsx's nearby-
  // users query calling this and throwing "supabase.from(...).not is not a
  // function" since it wasn't implemented.
  not(column: string, operator: FilterOp, value: any): this {
    this.filters.push({ column, op: operator, value, negate: true });
    return this;
  }
  or(expr: string): this {
    this.orPredicates.push(parseOrExpression(expr));
    return this;
  }
  order(column: string, options?: { ascending?: boolean }): this {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }
  limit(n: number): this {
    this.limitN = n;
    return this;
  }
  range(from: number, to: number): this {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }
  single(): this {
    this.singleMode = 'single';
    return this;
  }
  maybeSingle(): this {
    this.singleMode = 'maybeSingle';
    return this;
  }

  private matchesFilters(row: Row): boolean {
    for (const f of this.filters) {
      const result = applyOp(row[f.column], f.op, f.value);
      if (f.negate ? result : !result) return false;
    }
    for (const p of this.orPredicates) {
      if (!p(row)) return false;
    }
    return true;
  }

  private finalize(rows: Row[], count?: number | null, forceNullData = false): MockResult {
    const data = forceNullData ? null : rows;
    if (this.singleMode === 'single') {
      if (rows.length !== 1) {
        return {
          data: null,
          error: err(
            rows.length === 0 ? 'JSON object requested, multiple (or no) rows returned' : 'JSON object requested, more than one row returned',
            'PGRST116'
          ),
          count,
          status: rows.length === 0 ? 406 : 500,
          statusText: 'Not Acceptable',
        };
      }
      return { data: rows[0], error: null, count, status: 200, statusText: 'OK' };
    }
    if (this.singleMode === 'maybeSingle') {
      if (rows.length > 1) {
        return {
          data: null,
          error: err('JSON object requested, more than one row returned', 'PGRST116'),
          count,
          status: 500,
          statusText: 'Internal Server Error',
        };
      }
      return { data: rows[0] ?? null, error: null, count, status: 200, statusText: 'OK' };
    }
    return { data, error: null, count, status: 200, statusText: 'OK' };
  }

  private runSelect(): MockResult {
    const uid = this.currentUserId();
    const rls = rlsFor(this.table);
    let rows = db.all(this.table).filter((r) => rls.read(r, uid));
    if (rls.mask) rows = rows.map((r) => rls.mask!(r, uid));
    rows = rows.filter((r) => this.matchesFilters(r));
    const count = this.countMode ? rows.length : undefined;
    rows = multiSort(rows, this.orders);
    if (this.rangeFrom != null) {
      rows = rows.slice(this.rangeFrom, (this.rangeTo ?? rows.length - 1) + 1);
    } else if (this.limitN != null) {
      rows = rows.slice(0, this.limitN);
    }
    rows = projectCols(rows, this.selectCols, this.table);
    return this.finalize(rows, count);
  }

  private runInsert(): MockResult {
    const uid = this.currentUserId();
    const rls = rlsFor(this.table);
    const inputRows = Array.isArray(this.payload) ? this.payload : this.payload ? [this.payload] : [];
    for (const r of inputRows) {
      if (!rls.insert(r, uid)) {
        return {
          data: null,
          error: err(`new row violates row-level security policy for table "${this.table}"`, '42501'),
          status: 403,
          statusText: 'Forbidden',
        };
      }
    }
    const inserted: Row[] = [];
    for (const r of inputRows) {
      const full = fillInsertDefaults(this.table, r);
      db.putRaw(this.table, full);
      runInsertSideEffects(this.table, full);
      inserted.push(full);
    }
    const projected = this.wantSelect ? projectCols(inserted, this.selectCols, this.table) : inserted;
    return this.finalize(projected, undefined, !this.wantSelect);
  }

  private runUpdate(): MockResult {
    const uid = this.currentUserId();
    const rls = rlsFor(this.table);
    const candidates = db.all(this.table).filter((r) => this.matchesFilters(r));
    const allowed = candidates.filter((r) => rls.update(r, uid));
    if (candidates.length > 0 && allowed.length === 0) {
      return {
        data: null,
        error: err(`new row violates row-level security policy for table "${this.table}"`, '42501'),
        status: 403,
        statusText: 'Forbidden',
      };
    }
    const updated: Row[] = [];
    for (const before of allowed) {
      const after = db.updateRaw(this.table, before.id, this.payload as Row);
      if (after) {
        runUpdateSideEffects(this.table, before, after);
        updated.push(after);
      }
    }
    const projected = this.wantSelect ? projectCols(updated, this.selectCols, this.table) : updated;
    return this.finalize(projected, undefined, !this.wantSelect);
  }

  private runUpsert(): MockResult {
    const uid = this.currentUserId();
    const rls = rlsFor(this.table);
    const inputRows = Array.isArray(this.payload) ? this.payload : this.payload ? [this.payload] : [];
    const conflictCols = this.upsertOptions.onConflict
      ? this.upsertOptions.onConflict.split(',').map((c) => c.trim())
      : UPSERT_CONFLICT_KEYS[this.table] ?? ['id'];

    const results: Row[] = [];
    for (const incoming of inputRows) {
      const existing = db.all(this.table).find((row) => conflictCols.every((c) => row[c] !== undefined && valuesEqual(row[c], incoming[c])));
      if (existing) {
        if (!rls.update(existing, uid) && !rls.insert(existing, uid)) {
          return {
            data: null,
            error: err(`new row violates row-level security policy for table "${this.table}"`, '42501'),
            status: 403,
            statusText: 'Forbidden',
          };
        }
        const after = db.updateRaw(this.table, existing.id, incoming);
        if (after) results.push(after);
      } else {
        if (!rls.insert(incoming, uid)) {
          return {
            data: null,
            error: err(`new row violates row-level security policy for table "${this.table}"`, '42501'),
            status: 403,
            statusText: 'Forbidden',
          };
        }
        const full = fillInsertDefaults(this.table, incoming);
        db.putRaw(this.table, full);
        runInsertSideEffects(this.table, full);
        results.push(full);
      }
    }
    const projected = this.wantSelect ? projectCols(results, this.selectCols, this.table) : results;
    return this.finalize(projected, undefined, !this.wantSelect);
  }

  private runDelete(): MockResult {
    const uid = this.currentUserId();
    const rls = rlsFor(this.table);
    const candidates = db.all(this.table).filter((r) => this.matchesFilters(r));
    const allowed = candidates.filter((r) => rls.delete(r, uid));
    const deleted: Row[] = [];
    for (const row of allowed) {
      const removed = db.deleteRaw(this.table, row.id);
      if (removed) {
        runDeleteSideEffects(this.table, removed);
        deleted.push(removed);
      }
    }
    const projected = this.wantSelect ? projectCols(deleted, this.selectCols, this.table) : deleted;
    return this.finalize(projected, undefined, !this.wantSelect);
  }

  private execute(): MockResult {
    try {
      switch (this.opType) {
        case 'select':
          return this.runSelect();
        case 'insert':
          return this.runInsert();
        case 'update':
          return this.runUpdate();
        case 'upsert':
          return this.runUpsert();
        case 'delete':
          return this.runDelete();
        default:
          return this.runSelect();
      }
    } catch (e: any) {
      console.error(`[mock-backend] query error on "${this.table}":`, e);
      return {
        data: null,
        error: err(e?.message ?? 'Unexpected mock backend error'),
        status: 500,
        statusText: 'Internal Server Error',
      };
    }
  }

  // Thenable implementation so `await builder` / `builder.then(...)` both work,
  // exactly like the real supabase-js PostgrestBuilder.
  then<TResult1 = MockResult<T>, TResult2 = never>(
    onfulfilled?: ((value: MockResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve().then(() => this.execute()).then(onfulfilled, onrejected);
  }
}
