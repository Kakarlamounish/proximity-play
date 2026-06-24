import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  intensity: number;
  timestamp: Date;
}

export type HeatmapTimeRange = 'week' | 'month' | 'year' | 'all';

interface HeatmapState {
  points: Record<string, HeatmapPoint[]>;
  loading: boolean;
  addPoint: (
    userId: string,
    point: Omit<HeatmapPoint, 'timestamp'> & { accuracyMeters?: number }
  ) => Promise<void>;
  fetchHeatmap: (userId: string, timeRange?: HeatmapTimeRange) => Promise<HeatmapPoint[]>;
  clearHeatmap: (userId: string) => Promise<void>;
}

const cutoff = (range: HeatmapTimeRange): Date | null => {
  const now = Date.now();
  switch (range) {
    case 'week':
      return new Date(now - 7 * 86400000);
    case 'month':
      return new Date(now - 30 * 86400000);
    case 'year':
      return new Date(now - 365 * 86400000);
    default:
      return null;
  }
};

export const useHeatmapStore = create<HeatmapState>((set) => ({
  points: {},
  loading: false,

  addPoint: async (userId, point) => {
    await supabase.from('location_history').insert({
      user_id: userId,
      latitude: point.latitude,
      longitude: point.longitude,
      intensity: point.intensity ?? 1,
      accuracy_meters: point.accuracyMeters ?? null,
    });
  },

  fetchHeatmap: async (userId, timeRange = 'all') => {
    set({ loading: true });
    let q = supabase
      .from('location_history')
      .select('latitude,longitude,intensity,recorded_at')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(1000);
    const since = cutoff(timeRange);
    if (since) q = q.gte('recorded_at', since.toISOString());
    const { data, error } = await q;
    set({ loading: false });
    if (error || !data) return [];
    const mapped: HeatmapPoint[] = data.map((r: any) => ({
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      intensity: Number(r.intensity),
      timestamp: new Date(r.recorded_at),
    }));
    set((s) => ({ points: { ...s.points, [userId]: mapped } }));
    return mapped;
  },

  clearHeatmap: async (userId) => {
    await supabase.from('location_history').delete().eq('user_id', userId);
    set((s) => ({ points: { ...s.points, [userId]: [] } }));
  },
}));
