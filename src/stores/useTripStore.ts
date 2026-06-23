import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Trip {
  id: string;
  name: string;
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  route: Array<{ latitude: number; longitude: number }>;
  currentLocation?: { latitude: number; longitude: number };
  eta: Date | null;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  sharedWith: string[]; // friend IDs
  createdBy: string;
  createdAt: Date;
}

interface TripState {
  trips: Trip[];
  activeTripId: string | null;
  createTrip: (trip: Omit<Trip, 'id' | 'createdAt' | 'status'>) => void;
  updateTrip: (id: string, updates: Partial<Trip>) => void;
  cancelTrip: (id: string) => void;
  completeTrip: (id: string) => void;
  setActiveTrip: (id: string | null) => void;
  getActiveTrip: () => Trip | null;
  getTripsSharedWithMe: (userId: string) => Trip[];
}

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      trips: [],
      activeTripId: null,
      createTrip: (trip) =>
        set((state) => ({
          trips: [
            ...state.trips,
            {
              ...trip,
              id: crypto.randomUUID(),
              status: 'pending',
              createdAt: new Date(),
            },
          ],
          activeTripId: crypto.randomUUID(), // Will be updated after creation
        })),
      updateTrip: (id, updates) =>
        set((state) => ({
          trips: state.trips.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
      cancelTrip: (id) =>
        set((state) => ({
          trips: state.trips.map((t) => (t.id === id ? { ...t, status: 'cancelled' } : t)),
          activeTripId: state.activeTripId === id ? null : state.activeTripId,
        })),
      completeTrip: (id) =>
        set((state) => ({
          trips: state.trips.map((t) => (t.id === id ? { ...t, status: 'completed' } : t)),
          activeTripId: state.activeTripId === id ? null : state.activeTripId,
        })),
      setActiveTrip: (id) => set({ activeTripId: id }),
      getActiveTrip: () => {
        const state = get();
        return state.trips.find((t) => t.id === state.activeTripId) || null;
      },
      getTripsSharedWithMe: (userId) =>
        get().trips.filter((t) => t.sharedWith.includes(userId)),
    }),
    {
      name: 'trip-storage',
    }
  )
);
