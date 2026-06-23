import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Geofence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  userId: string;
  friendId?: string;
  alertOnEnter: boolean;
  alertOnLeave: boolean;
  createdAt: Date;
}

interface GeofenceState {
  geofences: Geofence[];
  addGeofence: (geofence: Omit<Geofence, 'id' | 'createdAt'>) => void;
  removeGeofence: (id: string) => void;
  updateGeofence: (id: string, updates: Partial<Geofence>) => void;
  getGeofencesForUser: (userId: string) => Geofence[];
}

export const useGeofenceStore = create<GeofenceState>()(
  persist(
    (set, get) => ({
      geofences: [],
      addGeofence: (geofence) =>
        set((state) => ({
          geofences: [
            ...state.geofences,
            { ...geofence, id: crypto.randomUUID(), createdAt: new Date() },
          ],
        })),
      removeGeofence: (id) =>
        set((state) => ({
          geofences: state.geofences.filter((g) => g.id !== id),
        })),
      updateGeofence: (id, updates) =>
        set((state) => ({
          geofences: state.geofences.map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        })),
      getGeofencesForUser: (userId) =>
        get().geofences.filter((g) => g.userId === userId),
    }),
    {
      name: 'geofence-storage',
    }
  )
);
