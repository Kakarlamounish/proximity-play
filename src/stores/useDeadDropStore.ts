import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DeadDropType = 'text' | 'image' | 'voice';

interface DeadDrop {
  id: string;
  latitude: number;
  longitude: number;
  radius: number; // meters
  type: DeadDropType;
  content: string; // text content or URL for image/voice
  createdBy: string;
  createdAt: Date;
  expiresAt?: Date;
  viewedBy: string[];
  maxViews?: number;
  title: string;
}

interface DeadDropState {
  deadDrops: DeadDrop[];
  addDeadDrop: (drop: Omit<DeadDrop, 'id' | 'createdAt' | 'viewedBy'>) => void;
  removeDeadDrop: (id: string) => void;
  markAsViewed: (id: string, userId: string) => void;
  getNearbyDrops: (lat: number, lng: number, radius?: number) => DeadDrop[];
}

export const useDeadDropStore = create<DeadDropState>()(
  persist(
    (set, get) => ({
      deadDrops: [],
      addDeadDrop: (drop) =>
        set((state) => ({
          deadDrops: [
            ...state.deadDrops,
            {
              ...drop,
              id: crypto.randomUUID(),
              createdAt: new Date(),
              viewedBy: [],
            },
          ],
        })),
      removeDeadDrop: (id) =>
        set((state) => ({
          deadDrops: state.deadDrops.filter((d) => d.id !== id),
        })),
      markAsViewed: (id, userId) =>
        set((state) => ({
          deadDrops: state.deadDrops.map((d) =>
            d.id === id && !d.viewedBy.includes(userId)
              ? { ...d, viewedBy: [...d.viewedBy, userId] }
              : d
          ),
        })),
      getNearbyDrops: (lat, lng, radius = 100) => {
        const drops = get().deadDrops;
        return drops.filter((drop) => {
          const distance = Math.sqrt(
            Math.pow(drop.latitude - lat, 2) + Math.pow(drop.longitude - lng, 2)
          ) * 111000; // Rough conversion to meters
          return distance <= drop.radius && (!drop.expiresAt || new Date(drop.expiresAt) > new Date());
        });
      },
    }),
    {
      name: 'dead-drop-storage',
    }
  )
);
