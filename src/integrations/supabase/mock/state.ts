// Shared mutable state for the mock backend: the in-memory "database",
// the current auth user pointer, and a tiny change-notification bus that
// realtime.ts listens on. Kept in its own module (rather than inside db.ts
// or auth.ts) so db.ts and auth.ts can both reference it without forming an
// import cycle.

export type Row = Record<string, any>;

export type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export type ChangeListener = (table: string, event: ChangeEvent, newRow: Row | null, oldRow: Row | null) => void;

class MockDatabase {
  private tables = new Map<string, Map<string, Row>>();
  private listeners = new Set<ChangeListener>();

  private tableMap(table: string): Map<string, Row> {
    let t = this.tables.get(table);
    if (!t) {
      t = new Map();
      this.tables.set(table, t);
    }
    return t;
  }

  /** All rows for a table, as shallow-cloned plain objects (insertion order). */
  all(table: string): Row[] {
    return Array.from(this.tableMap(table).values()).map((r) => ({ ...r }));
  }

  get(table: string, id: string): Row | undefined {
    const row = this.tableMap(table).get(id);
    return row ? { ...row } : undefined;
  }

  /** Insert a raw row with no RLS/validation — used by seed.ts, auth.ts, and trigger replication. */
  putRaw(table: string, row: Row, options: { silent?: boolean } = {}): Row {
    const stored = { ...row };
    this.tableMap(table).set(stored.id, stored);
    if (!options.silent) this.notify(table, 'INSERT', { ...stored }, null);
    return { ...stored };
  }

  updateRaw(table: string, id: string, patch: Row, options: { silent?: boolean } = {}): Row | undefined {
    const map = this.tableMap(table);
    const existing = map.get(id);
    if (!existing) return undefined;
    const old = { ...existing };
    const updated = { ...existing, ...patch };
    map.set(id, updated);
    if (!options.silent) this.notify(table, 'UPDATE', { ...updated }, old);
    return { ...updated };
  }

  deleteRaw(table: string, id: string, options: { silent?: boolean } = {}): Row | undefined {
    const map = this.tableMap(table);
    const existing = map.get(id);
    if (!existing) return undefined;
    map.delete(id);
    if (!options.silent) this.notify(table, 'DELETE', null, { ...existing });
    return existing;
  }

  clear(): void {
    this.tables.clear();
  }

  tableNames(): string[] {
    return Array.from(this.tables.keys());
  }

  onChange(fn: ChangeListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(table: string, event: ChangeEvent, newRow: Row | null, oldRow: Row | null): void {
    for (const fn of this.listeners) {
      try {
        fn(table, event, newRow, oldRow);
      } catch (e) {
        console.error('[mock-backend] realtime listener error:', e);
      }
    }
  }
}

export const db = new MockDatabase();

/** Points at the currently "authenticated" user id (or null when signed out). auth.ts owns writes to this. */
export const authState: { currentUserId: string | null } = {
  currentUserId: null,
};
