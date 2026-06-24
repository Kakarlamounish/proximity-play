import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export type DeadDropType = 'text' | 'image' | 'voice';

export interface DeadDrop {
  id: string;
  latitude: number;
  longitude: number;
  radius: number;
  type: DeadDropType;
  content: string;
  createdBy: string;
  createdAt: Date;
  expiresAt?: Date;
  viewedBy: string[];
  maxViews?: number;
  title: string;
}

interface DeadDropState {
  deadDrops: DeadDrop[];
  nearbyDrops: DeadDrop[];
  loading: boolean;
  fetchMyDrops: () => Promise<void>;
  fetchNearby: (lat: number, lng: number) => Promise<DeadDrop[]>;
  addDeadDrop: (
    drop: Omit<DeadDrop, 'id' | 'createdAt' | 'viewedBy'>
  ) => Promise<DeadDrop | null>;
  removeDeadDrop: (id: string) => Promise<void>;
  markAsViewed: (id: string, userId: string) => Promise<void>;
}

const fromRow = (row: any): DeadDrop => ({
  id: row.id,
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
  radius: Number(row.radius),
  type: row.type,
  content: row.content,
  createdBy: row.created_by,
  createdAt: new Date(row.created_at),
  expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
  viewedBy: row.viewed_by ?? [],
  maxViews: row.max_views ?? undefined,
  title: row.title,
});

export const useDeadDropStore = create<DeadDropState>((set, get) => ({
  deadDrops: [],
  nearbyDrops: [],
  loading: false,

  fetchMyDrops: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('dead_drops')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) set({ deadDrops: data.map(fromRow) });
    set({ loading: false });
  },

  fetchNearby: async (lat, lng) => {
    const { data, error } = await supabase.rpc('get_nearby_dead_drops', {
      user_lat: lat,
      user_lng: lng,
    });
    if (error || !data) return [];
    const mapped = (data as any[]).map(fromRow);
    set({ nearbyDrops: mapped });
    return mapped;
  },

  addDeadDrop: async (drop) => {
    const { data, error } = await supabase
      .from('dead_drops')
      .insert({
        title: drop.title,
        content: drop.content,
        type: drop.type,
        latitude: drop.latitude,
        longitude: drop.longitude,
        radius: drop.radius,
        created_by: drop.createdBy,
        expires_at: drop.expiresAt?.toISOString(),
        max_views: drop.maxViews,
      })
      .select()
      .single();
    if (error || !data) return null;
    const inserted = fromRow(data);
    set((s) => ({ deadDrops: [inserted, ...s.deadDrops] }));
    return inserted;
  },

  removeDeadDrop: async (id) => {
    const { error } = await supabase.from('dead_drops').delete().eq('id', id);
    if (!error) {
      set((s) => ({ deadDrops: s.deadDrops.filter((d) => d.id !== id) }));
    }
  },

  markAsViewed: async (id, userId) => {
    const drop =
      get().deadDrops.find((d) => d.id === id) ??
      get().nearbyDrops.find((d) => d.id === id);
    if (!drop || drop.viewedBy.includes(userId)) return;
    const viewed_by = [...drop.viewedBy, userId];
    await supabase.from('dead_drops').update({ viewed_by }).eq('id', id);
    set((s) => ({
      deadDrops: s.deadDrops.map((d) => (d.id === id ? { ...d, viewedBy: viewed_by } : d)),
      nearbyDrops: s.nearbyDrops.map((d) =>
        d.id === id ? { ...d, viewedBy: viewed_by } : d
      ),
    }));
  },
}));
