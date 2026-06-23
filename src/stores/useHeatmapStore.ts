import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface HeatmapPoint {
  latitude: number;
  longitude: number;
  intensity: number;
  timestamp: Date;
}

interface HeatmapData {
  userId: string;
  points: HeatmapPoint[];
  timeRange: 'week' | 'month' | 'year' | 'all';
}

interface HeatmapState {
  heatmapData: Record<string, HeatmapData>;
  addPoint: (userId: string, point: Omit<HeatmapPoint, 'timestamp'>) => void;
  getHeatmapData: (userId: string, timeRange?: HeatmapData['timeRange']) => HeatmapPoint[];
  clearHeatmap: (userId: string) => void;
}

export const useHeatmapStore = create<HeatmapState>()(
  persist(
    (set, get) => ({
      heatmapData: {},
      addPoint: (userId, point) =>
        set((state) => {
          const existing = state.heatmapData[userId] || {
            userId,
            points: [],
            timeRange: 'all',
          };
          
          return {
            heatmapData: {
              ...state.heatmapData,
              [userId]: {
                ...existing,
                points: [...existing.points, { ...point, timestamp: new Date() }],
              },
            },
          };
        }),
      getHeatmapData: (userId, timeRange = 'all') => {
        const data = get().heatmapData[userId];
        if (!data) return [];

        const now = new Date();
        let cutoffDate: Date;

        switch (timeRange) {
          case 'week':
            cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'year':
            cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
          default:
            return data.points;
        }

        return data.points.filter((p) => p.timestamp >= cutoffDate);
      },
      clearHeatmap: (userId) =>
        set((state) => ({
          heatmapData: {
            ...state.heatmapData,
            [userId]: { userId, points: [], timeRange: 'all' },
          },
        })),
    }),
    {
      name: 'heatmap-storage',
    }
  )
);
