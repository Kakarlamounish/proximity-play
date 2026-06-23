import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface Trip {
  id: string;
  name: string;
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  route: Array<{ latitude: number; longitude: number }>;
  currentLocation?: { latitude: number; longitude: number };
  eta: string | null; // ISO
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  sharedWith: string[];
  createdBy: string;
  createdAt: string;
}

interface TripRow {
  id: string;
  name: string;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  route: Array<{ latitude: number; longitude: number }> | null;
  current_lat: number | null;
  current_lng: number | null;
  eta: string | null;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  shared_with: string[] | null;
  created_by: string;
  created_at: string;
}

function rowToTrip(r: TripRow): Trip {
  return {
    id: r.id,
    name: r.name,
    origin: { latitude: r.origin_lat, longitude: r.origin_lng },
    destination: { latitude: r.destination_lat, longitude: r.destination_lng },
    route: r.route ?? [],
    currentLocation:
      r.current_lat != null && r.current_lng != null
        ? { latitude: r.current_lat, longitude: r.current_lng }
        : undefined,
    eta: r.eta,
    status: r.status,
    sharedWith: r.shared_with ?? [],
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

interface TripState {
  trips: Trip[];
  activeTripId: string | null;
  loading: boolean;
  fetchTrips: () => Promise<void>;
  createTrip: (
    trip: Omit<Trip, 'id' | 'createdAt' | 'status'>
  ) => Promise<Trip | null>;
  updateTrip: (id: string, updates: Partial<Trip>) => Promise<void>;
  cancelTrip: (id: string) => Promise<void>;
  completeTrip: (id: string) => Promise<void>;
  setActiveTrip: (id: string | null) => void;
  getActiveTrip: () => Trip | null;
  getTripsSharedWithMe: (userId: string) => Trip[];
}

export const useTripStore = create<TripState>()((set, get) => ({
  trips: [],
  activeTripId: null,
  loading: false,

  fetchTrips: async () => {
    set({ loading: true });
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      set({ trips: [], loading: false });
      return;
    }
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .or(`created_by.eq.${uid},shared_with.cs.{${uid}}`)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('fetchTrips error:', error);
      set({ loading: false });
      return;
    }
    set({
      trips: (data as TripRow[]).map(rowToTrip),
      loading: false,
    });
  },

  createTrip: async (trip) => {
    const { data, error } = await supabase
      .from('trips')
      .insert({
        name: trip.name,
        origin_lat: trip.origin.latitude,
        origin_lng: trip.origin.longitude,
        destination_lat: trip.destination.latitude,
        destination_lng: trip.destination.longitude,
        route: trip.route,
        current_lat: trip.currentLocation?.latitude ?? null,
        current_lng: trip.currentLocation?.longitude ?? null,
        eta: trip.eta,
        status: 'pending',
        shared_with: trip.sharedWith,
        created_by: trip.createdBy,
      })
      .select('*')
      .single();
    if (error || !data) {
      console.error('createTrip error:', error);
      return null;
    }
    const newTrip = rowToTrip(data as TripRow);
    set((s) => ({ trips: [newTrip, ...s.trips], activeTripId: newTrip.id }));
    return newTrip;
  },

  updateTrip: async (id, updates) => {
    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.currentLocation) {
      patch.current_lat = updates.currentLocation.latitude;
      patch.current_lng = updates.currentLocation.longitude;
    }
    if (updates.eta !== undefined) patch.eta = updates.eta;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.sharedWith !== undefined) patch.shared_with = updates.sharedWith;
    if (updates.route !== undefined) patch.route = updates.route;

    set((s) => ({
      trips: s.trips.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
    const { error } = await supabase.from('trips').update(patch).eq('id', id);
    if (error) console.error('updateTrip error:', error);
  },

  cancelTrip: async (id) => {
    await get().updateTrip(id, { status: 'cancelled' });
    set((s) => ({ activeTripId: s.activeTripId === id ? null : s.activeTripId }));
  },

  completeTrip: async (id) => {
    await get().updateTrip(id, { status: 'completed' });
    set((s) => ({ activeTripId: s.activeTripId === id ? null : s.activeTripId }));
  },

  setActiveTrip: (id) => set({ activeTripId: id }),
  getActiveTrip: () => {
    const s = get();
    return s.trips.find((t) => t.id === s.activeTripId) || null;
  },
  getTripsSharedWithMe: (userId) =>
    get().trips.filter((t) => t.sharedWith.includes(userId)),
}));
