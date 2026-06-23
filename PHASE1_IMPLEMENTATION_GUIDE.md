# Phase 1 Implementation Guide: Geofencing, Haptic Feedback & Battery Saver

This guide implements the first phase of UX improvements for production launch.

## ✅ Completed: Database Migration

**File**: `supabase/migrations/20250102000000_add_geofencing_and_trips.sql`

Run this migration in your Supabase dashboard:
```bash
supabase db push
```

### What it adds:
- `geofences` table - Store geographic boundaries with enter/exit triggers
- `live_trips` table - Active route sharing with ETA
- `location_history` table - Historical data for heatmaps (30-day retention)
- `geofence_notifications` table - Alert queue
- Enhanced `profiles` table with battery_saver_mode, custom_avatar_url, map_icon_style, accent_color
- Complete RLS policies for security
- Performance indexes

---

## 📝 Step 2: Create Geofencing Store

**File**: `src/stores/useGeofencingStore.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Geofence {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  trigger_type: 'enter' | 'exit' | 'both';
  target_user_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface LiveTrip {
  id: string;
  user_id: string;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  route_geometry?: any;
  eta?: string;
  status: 'active' | 'completed' | 'cancelled';
  shared_with: string[];
  started_at: string;
  completed_at?: string;
  created_at: string;
}

interface GeofenceNotification {
  id: string;
  geofence_id: string;
  user_id: string;
  triggered_by_user_id?: string;
  trigger_type: 'enter' | 'exit';
  triggered_at: string;
  is_read: boolean;
  message: string;
}

interface GeofencingState {
  geofences: Geofence[];
  isLoadingGeofences: boolean;
  activeTrips: LiveTrip[];
  isLoadingTrips: boolean;
  geofenceNotifications: GeofenceNotification[];
  unreadCount: number;
  batterySaverMode: boolean;
  
  // Geofence Actions
  fetchGeofences: () => Promise<void>;
  createGeofence: (geofence: Omit<Geofence, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateGeofence: (id: string, updates: Partial<Geofence>) => Promise<void>;
  deleteGeofence: (id: string) => Promise<void>;
  
  // Trip Actions
  fetchActiveTrips: () => Promise<void>;
  createLiveTrip: (trip: Omit<LiveTrip, 'id' | 'started_at' | 'created_at'>) => Promise<void>;
  updateLiveTrip: (id: string, updates: Partial<LiveTrip>) => Promise<void>;
  cancelLiveTrip: (id: string) => Promise<void>;
  
  // Notification Actions
  fetchGeofenceNotifications: () => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  
  // Settings
  setBatterySaverMode: (enabled: boolean) => void;
  checkGeofenceTriggers: (latitude: number, longitude: number) => void;
}

export const useGeofencingStore = create<GeofencingState>()(
  persist(
    (set, get) => ({
      geofences: [],
      isLoadingGeofences: false,
      activeTrips: [],
      isLoadingTrips: false,
      geofenceNotifications: [],
      unreadCount: 0,
      batterySaverMode: false,

      fetchGeofences: async () => {
        set({ isLoadingGeofences: true });
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { data, error } = await supabase
            .from('geofences')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

          if (error) throw error;
          set({ geofences: data || [], isLoadingGeofences: false });
        } catch (error) {
          console.error('Error fetching geofences:', error);
          set({ isLoadingGeofences: false });
        }
      },

      createGeofence: async (geofence) => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { data, error } = await supabase
            .from('geofences')
            .insert([geofence])
            .select()
            .single();

          if (error) throw error;
          set((state) => ({ geofences: [data, ...state.geofences] }));
        } catch (error) {
          console.error('Error creating geofence:', error);
          throw error;
        }
      },

      updateGeofence: async (id, updates) => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { error } = await supabase
            .from('geofences')
            .update(updates)
            .eq('id', id);

          if (error) throw error;
          set((state) => ({
            geofences: state.geofences.map((g) =>
              g.id === id ? { ...g, ...updates } : g
            )
          }));
        } catch (error) {
          console.error('Error updating geofence:', error);
          throw error;
        }
      },

      deleteGeofence: async (id) => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { error } = await supabase
            .from('geofences')
            .delete()
            .eq('id', id);

          if (error) throw error;
          set((state) => ({
            geofences: state.geofences.filter((g) => g.id !== id)
          }));
        } catch (error) {
          console.error('Error deleting geofence:', error);
          throw error;
        }
      },

      fetchActiveTrips: async () => {
        set({ isLoadingTrips: true });
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { data, error } = await supabase
            .from('live_trips')
            .select('*')
            .eq('status', 'active')
            .order('started_at', { ascending: false });

          if (error) throw error;
          set({ activeTrips: data || [], isLoadingTrips: false });
        } catch (error) {
          console.error('Error fetching trips:', error);
          set({ isLoadingTrips: false });
        }
      },

      createLiveTrip: async (trip) => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { data, error } = await supabase
            .from('live_trips')
            .insert([trip])
            .select()
            .single();

          if (error) throw error;
          set((state) => ({ activeTrips: [data, ...state.activeTrips] }));
        } catch (error) {
          console.error('Error creating trip:', error);
          throw error;
        }
      },

      updateLiveTrip: async (id, updates) => {
        await get().updateLiveTripCore(id, updates);
      },

      updateLiveTripCore: async (id, updates) => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { error } = await supabase
            .from('live_trips')
            .update(updates)
            .eq('id', id);

          if (error) throw error;
          set((state) => ({
            activeTrips: state.activeTrips.map((t) =>
              t.id === id ? { ...t, ...updates } : t
            )
          }));
        } catch (error) {
          console.error('Error updating trip:', error);
          throw error;
        }
      },

      cancelLiveTrip: async (id) => {
        await get().updateLiveTripCore(id, {
          status: 'cancelled',
          completed_at: new Date().toISOString()
        });
      },

      fetchGeofenceNotifications: async () => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { data, error } = await supabase
            .from('geofence_notifications')
            .select('*')
            .order('triggered_at', { ascending: false })
            .limit(50);

          if (error) throw error;
          const unread = data?.filter((n) => !n.is_read).length || 0;
          set({ geofenceNotifications: data || [], unreadCount: unread });
        } catch (error) {
          console.error('Error fetching notifications:', error);
        }
      },

      markNotificationAsRead: async (id) => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { error } = await supabase
            .from('geofence_notifications')
            .update({ is_read: true })
            .eq('id', id);

          if (error) throw error;
          set((state) => ({
            geofenceNotifications: state.geofenceNotifications.map((n) =>
              n.id === id ? { ...n, is_read: true } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1)
          }));
        } catch (error) {
          console.error('Error marking notification as read:', error);
        }
      },

      markAllNotificationsAsRead: async () => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { error } = await supabase
            .from('geofence_notifications')
            .update({ is_read: true })
            .eq('is_read', false);

          if (error) throw error;
          set({ 
            geofenceNotifications: get().geofenceNotifications.map((n) => ({ ...n, is_read: true })),
            unreadCount: 0
          });
        } catch (error) {
          console.error('Error marking notifications as read:', error);
        }
      },

      setBatterySaverMode: (enabled) => {
        set({ batterySaverMode: enabled });
      },

      checkGeofenceTriggers: (latitude: number, longitude: number) => {
        const { geofences } = get();
        
        geofences.forEach((geofence) => {
          if (!geofence.is_active) return;
          
          const distance = calculateDistance(
            latitude, longitude,
            geofence.center_lat, geofence.center_lng
          );
          
          const isInside = distance <= geofence.radius_meters;
          const lastStateKey = `geofence_${geofence.id}_last_state`;
          const wasInside = localStorage.getItem(lastStateKey) === 'true';
          
          let shouldTrigger = false;
          let triggerType: 'enter' | 'exit' | null = null;
          
          if (isInside && !wasInside) {
            if (geofence.trigger_type === 'enter' || geofence.trigger_type === 'both') {
              shouldTrigger = true;
              triggerType = 'enter';
            }
          } else if (!isInside && wasInside) {
            if (geofence.trigger_type === 'exit' || geofence.trigger_type === 'both') {
              shouldTrigger = true;
              triggerType = 'exit';
            }
          }
          
          localStorage.setItem(lastStateKey, isInside.toString());
          
          if (shouldTrigger && triggerType) {
            console.log(`Geofence triggered: ${geofence.name} (${triggerType})`);
            if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200]);
            }
          }
        });
      }
    }),
    {
      name: 'geofencing-storage',
      partialize: (state) => ({ batterySaverMode: state.batterySaverMode })
    }
  )
);

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
```

---

## 📝 Step 3: Create Haptic Feedback Hook

**File**: `src/hooks/useHapticFeedback.ts`

```typescript
import { useCallback } from 'react';

type HapticPattern = 
  | 'light'      // Short vibration for taps
  | 'medium'     // Medium vibration for actions
  | 'heavy'      // Long vibration for important events
  | 'success'    // Double pulse for success
  | 'error'      // Triple pulse for errors
  | 'geofence';  // Custom pattern for geofence alerts

export const useHapticFeedback = () => {
  const patterns: Record<HapticPattern, number[]> = {
    light: [50],
    medium: [100],
    heavy: [200],
    success: [100, 50, 100],
    error: [200, 50, 200, 50, 200],
    geofence: [200, 100, 200]
  };

  const vibrate = useCallback((pattern: HapticPattern = 'light') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(patterns[pattern]);
    }
  }, []);

  const triggerLight = useCallback(() => vibrate('light'), [vibrate]);
  const triggerMedium = useCallback(() => vibrate('medium'), [vibrate]);
  const triggerHeavy = useCallback(() => vibrate('heavy'), [vibrate]);
  const triggerSuccess = useCallback(() => vibrate('success'), [vibrate]);
  const triggerError = useCallback(() => vibrate('error'), [vibrate]);
  const triggerGeofence = useCallback(() => vibrate('geofence'), [vibrate]);

  return {
    vibrate,
    triggerLight,
    triggerMedium,
    triggerHeavy,
    triggerSuccess,
    triggerError,
    triggerGeofence
  };
};
```

---

## 📝 Step 4: Create Battery Saver Hook

**File**: `src/hooks/useBatterySaver.ts`

```typescript
import { useEffect, useState } from 'react';
import { useGeofencingStore } from '@/stores/useGeofencingStore';

interface BatteryInfo {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
}

export const useBatterySaver = () => {
  const { batterySaverMode, setBatterySaverMode } = useGeofencingStore();
  const [batteryInfo, setBatteryInfo] = useState<BatteryInfo | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if ('getBattery' in navigator) {
      setIsSupported(true);
      
      (navigator as any).getBattery().then((battery: any) => {
        const updateBatteryInfo = () => {
          setBatteryInfo({
            level: battery.level,
            charging: battery.charging,
            chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime
          });

          // Auto-enable battery saver when below 20% and not charging
          if (battery.level < 0.2 && !battery.charging && !batterySaverMode) {
            setBatterySaverMode(true);
          }
        };

        updateBatteryInfo();
        
        battery.addEventListener('levelchange', updateBatteryInfo);
        battery.addEventListener('chargingchange', updateBatteryInfo);

        return () => {
          battery.removeEventListener('levelchange', updateBatteryInfo);
          battery.removeEventListener('chargingchange', updateBatteryInfo);
        };
      });
    }
  }, [batterySaverMode, setBatterySaverMode]);

  const getLocationUpdateInterval = () => {
    if (batterySaverMode) {
      return 300000; // 5 minutes
    }
    return 30000; // 30 seconds
  };

  return {
    batterySaverMode,
    setBatterySaverMode,
    batteryInfo,
    isSupported,
    locationUpdateInterval: getLocationUpdateInterval(),
    isLowBattery: batteryInfo ? batteryInfo.level < 0.2 : false
  };
};
```

---

## 📝 Step 5: Update Map Component with Smooth Camera & 3D Buildings

**File**: `src/components/Map.tsx` (add/modify these functions)

```typescript
// Add smooth camera fly-to function
const flyToLocation = (map: mapboxgl.Map, lng: number, lat: number, zoom?: number) => {
  map.flyTo({
    center: [lng, lat],
    zoom: zoom ?? map.getZoom(),
    essential: true,
    duration: 1500, // 1.5 seconds
    easing: (t) => t * (2 - t) // Ease-out cubic
  });
};

// Enable 3D buildings layer
const add3DBuildings = (map: mapboxgl.Map) => {
  map.on('load', () => {
    const layers = map.getStyle().layers;
    const labelLayerId = layers?.find(
      (layer) => layer.type === 'symbol' && layer.layout?.['text-field']
    )?.id;

    map.addLayer(
      {
        id: 'add-3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 15,
        paint: {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'height']
          ],
          'fill-extrusion-base': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'min_height']
          ],
          'fill-extrusion-opacity': 0.8
        }
      },
      labelLayerId
    );
  });
};

// Usage in component
useEffect(() => {
  if (mapRef.current) {
    add3DBuildings(mapRef.current);
  }
}, []);
```

---

## 📝 Step 6: Create Geofence Management UI Component

**File**: `src/components/GeofenceManager.tsx`

```typescript
import React, { useState } from 'react';
import { useGeofencingStore } from '@/stores/useGeofencingStore';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { X, Bell, MapPin, Trash2, Edit } from 'lucide-react';

export const GeofenceManager: React.FC = () => {
  const { 
    geofences, 
    fetchGeofences, 
    createGeofence, 
    deleteGeofence,
    isLoadingGeofences 
  } = useGeofencingStore();
  
  const { triggerLight, triggerSuccess } = useHapticFeedback();
  const [isOpen, setIsOpen] = useState(false);
  const [newGeofence, setNewGeofence] = useState({
    name: '',
    description: '',
    radius_meters: 100,
    trigger_type: 'enter' as 'enter' | 'exit' | 'both'
  });

  const handleCreate = async (lat: number, lng: number) => {
    triggerLight();
    
    try {
      await createGeofence({
        user_id: 'current-user-id', // Replace with actual user ID from auth
        name: newGeofence.name,
        description: newGeofence.description,
        center_lat: lat,
        center_lng: lng,
        radius_meters: newGeofence.radius_meters,
        trigger_type: newGeofence.trigger_type,
        is_active: true
      });
      
      triggerSuccess();
      setNewGeofence({ name: '', description: '', radius_meters: 100, trigger_type: 'enter' });
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to create geofence:', error);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          triggerLight();
          setIsOpen(true);
          fetchGeofences();
        }}
        className="fixed bottom-20 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        aria-label="Manage Geofences"
      >
        <Bell size={24} />
        {useGeofencingStore((state) => state.unreadCount) > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
            {useGeofencingStore((state) => state.unreadCount)}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-t-lg sm:rounded-lg w-full sm:w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold">Geofence Alerts</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4">
              <h3 className="font-semibold mb-3">Create New Geofence</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Name (e.g., Home, Work)"
                  value={newGeofence.name}
                  onChange={(e) => setNewGeofence({ ...newGeofence, name: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={newGeofence.description}
                  onChange={(e) => setNewGeofence({ ...newGeofence, description: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
                <div className="flex gap-2">
                  <label className="flex-1">
                    <span className="text-sm">Radius (meters)</span>
                    <input
                      type="number"
                      value={newGeofence.radius_meters}
                      onChange={(e) => setNewGeofence({ ...newGeofence, radius_meters: parseInt(e.target.value) })}
                      className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                    />
                  </label>
                  <label className="flex-1">
                    <span className="text-sm">Trigger</span>
                    <select
                      value={newGeofence.trigger_type}
                      onChange={(e) => setNewGeofence({ ...newGeofence, trigger_type: e.target.value as any })}
                      className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                    >
                      <option value="enter">On Enter</option>
                      <option value="exit">On Exit</option>
                      <option value="both">Both</option>
                    </select>
                  </label>
                </div>
                <button
                  onClick={() => {
                    // Get current location
                    navigator.geolocation.getCurrentPosition((pos) => {
                      handleCreate(pos.coords.latitude, pos.coords.longitude);
                    });
                  }}
                  disabled={!newGeofence.name}
                  className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Create at Current Location
                </button>
              </div>
            </div>

            <div className="p-4 border-t dark:border-gray-700">
              <h3 className="font-semibold mb-3">Active Geofences</h3>
              {isLoadingGeofences ? (
                <div className="text-center py-4">Loading...</div>
              ) : geofences.length === 0 ? (
                <div className="text-center py-4 text-gray-500">No geofences yet</div>
              ) : (
                <div className="space-y-2">
                  {geofences.map((geofence) => (
                    <div
                      key={geofence.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin size={18} className="text-blue-600" />
                        <div>
                          <div className="font-medium">{geofence.name}</div>
                          <div className="text-xs text-gray-500">
                            {geofence.radius_meters}m • {geofence.trigger_type}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteGeofence(geofence.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
```

---

## 📝 Step 7: Integrate Into Your App

**File**: `src/App.tsx` or main layout component

```typescript
import { GeofenceManager } from '@/components/GeofenceManager';
import { useBatterySaver } from '@/hooks/useBatterySaver';
import { useGeofencingStore } from '@/stores/useGeofencingStore';

function App() {
  const { batterySaverMode, locationUpdateInterval } = useBatterySaver();
  const { checkGeofenceTriggers } = useGeofencingStore();

  // Monitor location and check geofences
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        checkGeofenceTriggers(position.coords.latitude, position.coords.longitude);
        
        // Update user location with appropriate interval based on battery saver
        updateUserLocation(position.coords, batterySaverMode);
      },
      (error) => console.error(error),
      {
        enableHighAccuracy: !batterySaverMode,
        timeout: 10000,
        maximumAge: locationUpdateInterval
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [batterySaverMode, locationUpdateInterval]);

  return (
    <>
      {/* Your existing app */}
      <GeofenceManager />
    </>
  );
}
```

---

## ✅ Testing Checklist

### Geofencing
- [ ] Create geofence at current location
- [ ] Walk into geofence area → verify notification and haptic feedback
- [ ] Walk out of geofence → verify exit notification
- [ ] Delete geofence → verify removal from list and map
- [ ] Test with multiple geofences simultaneously

### Battery Saver
- [ ] Check battery level detection works
- [ ] Auto-enable when battery < 20%
- [ ] Manual toggle works in settings
- [ ] Location updates slow down in battery saver mode

### Haptic Feedback
- [ ] Test on mobile device with vibration support
- [ ] Verify different patterns (light, medium, heavy, success, error)
- [ ] Ensure no errors on desktop (no vibration support)

### Map Enhancements
- [ ] Smooth camera transitions when clicking friend bubbles
- [ ] 3D buildings visible at zoom level 15+
- [ ] Performance remains smooth with 3D enabled

---

## 🚀 Next Steps

After completing Phase 1, proceed to:

**Phase 2 (Weeks 3-4)**:
- Live Trip Sharing with real-time ETA
- Voice Notes in chat
- Custom Avatars & Map Icons

**Phase 3 (Weeks 5-6)**:
- Dead Drop / Location-based messages
- Heatmaps / Memory Lane
- Referral System

Would you like me to create the Edge Function for server-side geofence monitoring next?
