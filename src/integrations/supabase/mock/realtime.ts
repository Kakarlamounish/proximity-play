// In-memory pub/sub standing in for Supabase Realtime (`supabase.channel(...)`).
//
// IMPORTANT LIMITATION: this only synchronizes channels within a single
// running app instance (one browser tab). There is no WebSocket, no server,
// and no cross-tab/cross-browser delivery — two tabs each running the mock
// backend are two completely independent worlds. That's fine for the vast
// majority of this app's QA flows (a single tester driving one tab), but it
// means "have two browser windows call each other" style manual tests will
// NOT work end-to-end the way they would against the real backend. See
// MOCK_BACKEND.md.
import { db, ChangeEvent, Row } from './state';

type PgEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface PgChangesConfig {
  event: PgEvent;
  schema?: string;
  table: string;
  filter?: string;
}

interface BroadcastConfig {
  event: string;
}

interface PresenceConfig {
  event: 'sync' | 'join' | 'leave';
}

type PgCallback = (payload: { eventType: ChangeEvent; new: Row | null; old: Row | null; schema: string; table: string }) => void;
type BroadcastCallback = (payload: { type: 'broadcast'; event: string; payload: any }) => void;
type PresenceCallback = () => void;

interface ChannelRegistryEntry {
  channels: Set<MockRealtimeChannel>;
  presenceState: Record<string, any[]>;
}

const registry = new Map<string, ChannelRegistryEntry>();

function registryFor(name: string): ChannelRegistryEntry {
  let entry = registry.get(name);
  if (!entry) {
    entry = { channels: new Set(), presenceState: {} };
    registry.set(name, entry);
  }
  return entry;
}

function parseSimpleFilter(filter: string): { column: string; op: string; value: string } | null {
  const eq = filter.indexOf('=');
  if (eq === -1) return null;
  const column = filter.slice(0, eq);
  const rest = filter.slice(eq + 1);
  const dot = rest.indexOf('.');
  if (dot === -1) return null;
  return { column, op: rest.slice(0, dot), value: rest.slice(dot + 1) };
}

function rowMatchesFilter(row: Row | null, filter?: string): boolean {
  if (!filter || !row) return true;
  const parsed = parseSimpleFilter(filter);
  if (!parsed) return true;
  const rowVal = row[parsed.column];
  switch (parsed.op) {
    case 'eq':
      // eslint-disable-next-line eqeqeq
      return rowVal == parsed.value;
    case 'neq':
      // eslint-disable-next-line eqeqeq
      return rowVal != parsed.value;
    default:
      return true;
  }
}

class MockRealtimeChannel {
  private pgSubs: { config: PgChangesConfig; cb: PgCallback }[] = [];
  private broadcastSubs: { config: BroadcastConfig; cb: BroadcastCallback }[] = [];
  private presenceSubs: { config: PresenceConfig; cb: PresenceCallback }[] = [];
  private presenceKey: string;
  private subscribed = false;

  constructor(public readonly name: string, opts?: { config?: { presence?: { key?: string } } }) {
    this.presenceKey = opts?.config?.presence?.key ?? `anon-${Math.random().toString(36).slice(2, 8)}`;
    registryFor(name).channels.add(this);
  }

  on(type: 'postgres_changes', config: PgChangesConfig, cb: PgCallback): this;
  on(type: 'broadcast', config: BroadcastConfig, cb: BroadcastCallback): this;
  on(type: 'presence', config: PresenceConfig, cb: PresenceCallback): this;
  on(type: string, config: any, cb: any): this {
    if (type === 'postgres_changes') this.pgSubs.push({ config, cb });
    else if (type === 'broadcast') this.broadcastSubs.push({ config, cb });
    else if (type === 'presence') this.presenceSubs.push({ config, cb });
    return this;
  }

  subscribe(callback?: (status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED', err?: Error) => void): this {
    this.subscribed = true;
    // Mimic the async connection handshake so callers that gate logic on
    // `status === 'SUBSCRIBED'` behave the same as against a real socket.
    Promise.resolve().then(() => callback?.('SUBSCRIBED'));
    return this;
  }

  async track(payload: Record<string, any>): Promise<'ok' | 'error'> {
    const entry = registryFor(this.name);
    entry.presenceState[this.presenceKey] = [{ ...payload, presence_ref: this.presenceKey }];
    this.firePresenceSync();
    return 'ok';
  }

  async untrack(): Promise<'ok' | 'error'> {
    const entry = registryFor(this.name);
    delete entry.presenceState[this.presenceKey];
    this.firePresenceSync();
    return 'ok';
  }

  presenceState(): Record<string, any[]> {
    return { ...registryFor(this.name).presenceState };
  }

  send(message: { type: 'broadcast'; event: string; payload: any }): 'ok' {
    const entry = registryFor(this.name);
    for (const ch of entry.channels) {
      if (ch === this) continue; // supabase-js excludes the sender by default (no `broadcast.self` config used here)
      for (const sub of ch.broadcastSubs) {
        if (sub.config.event === message.event) sub.cb({ type: 'broadcast', event: message.event, payload: message.payload });
      }
    }
    return 'ok';
  }

  private firePresenceSync(): void {
    const entry = registryFor(this.name);
    for (const ch of entry.channels) {
      for (const sub of ch.presenceSubs) {
        if (sub.config.event === 'sync') sub.cb();
      }
    }
  }

  /** Dispatches a table-change event to this channel's matching postgres_changes subscribers. */
  dispatchChange(table: string, event: ChangeEvent, newRow: Row | null, oldRow: Row | null): void {
    for (const sub of this.pgSubs) {
      if (sub.config.table !== table) continue;
      if (sub.config.event !== '*' && sub.config.event !== event) continue;
      const rowForFilter = event === 'DELETE' ? oldRow : newRow;
      if (!rowMatchesFilter(rowForFilter, sub.config.filter)) continue;
      sub.cb({ eventType: event, new: newRow, old: oldRow, schema: sub.config.schema ?? 'public', table });
    }
  }

  unsubscribe(): 'ok' {
    this.subscribed = false;
    registryFor(this.name).channels.delete(this);
    return 'ok';
  }
}

// Wire every mutation in the mock DB to every live channel's postgres_changes subscribers.
db.onChange((table, event, newRow, oldRow) => {
  for (const entry of registry.values()) {
    for (const ch of entry.channels) {
      ch.dispatchChange(table, event, newRow, oldRow);
    }
  }
});

export function mockChannel(name: string, opts?: { config?: { presence?: { key?: string } } }): MockRealtimeChannel {
  return new MockRealtimeChannel(name, opts);
}

export function mockRemoveChannel(channel: MockRealtimeChannel): Promise<'ok'> {
  channel?.unsubscribe?.();
  return Promise.resolve('ok');
}

export function mockGetChannels(): MockRealtimeChannel[] {
  return Array.from(registry.values()).flatMap((e) => Array.from(e.channels));
}

export type { MockRealtimeChannel };
