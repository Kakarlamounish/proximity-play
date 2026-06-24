import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MapPin, Eye, EyeOff, Users, Wifi, WifiOff, Navigation2, Globe, Layers, Mountain, Satellite, BatteryLow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { useBatterySaver } from '@/hooks/useBatterySaver';
import { haptic } from '@/lib/haptics';

interface FriendOnMap {
  user_id: string;
  first_name: string;
  profile_photo_url?: string;
  latitude: number;
  longitude: number;
  presence_status?: string;
  last_seen?: string;
}

type MapStyle = 'dark' | 'satellite' | 'terrain' | 'street';

const MAP_TILES: Record<MapStyle, { url: string; attribution: string; label: string; icon: React.ReactNode }> = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    label: 'Dark',
    icon: <Globe className="h-4 w-4" />,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    label: 'Satellite',
    icon: <Satellite className="h-4 w-4" />,
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
    label: 'Terrain',
    icon: <Mountain className="h-4 w-4" />,
  },
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    label: 'Street',
    icon: <Layers className="h-4 w-4" />,
  },
};

// Component to change tile layer dynamically
function DynamicTileLayer({ style }: { style: MapStyle }) {
  const map = useMap();
  const layerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (layerRef.current) map.removeLayer(layerRef.current);
    const tile = MAP_TILES[style];
    layerRef.current = L.tileLayer(tile.url, { attribution: tile.attribution }).addTo(map);
    return () => { if (layerRef.current) map.removeLayer(layerRef.current); };
  }, [style, map]);

  return null;
}

function FitBounds({ locations, myLocation }: { locations: FriendOnMap[]; myLocation?: { lat: number; lng: number } | null }) {
  const map = useMap();
  const fitted = useRef(false);
  
  useEffect(() => {
    if (fitted.current) return;
    const allPoints: [number, number][] = locations.map(l => [l.latitude, l.longitude]);
    if (myLocation) allPoints.push([myLocation.lat, myLocation.lng]);
    if (allPoints.length === 0) return;
    
    const bounds = L.latLngBounds(allPoints);
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    fitted.current = true;
  }, [locations, myLocation, map]);
  
  return null;
}

// Snapchat-style Bitmoji/avatar marker
function createSnapMarker(name: string, avatarUrl?: string, isOnline?: boolean) {
  const statusDot = isOnline
    ? '<div style="position:absolute;bottom:-2px;right:-2px;width:14px;height:14px;background:#00E676;border-radius:50%;border:2.5px solid #1a1a2e;z-index:2"></div>'
    : '';

  const avatarHtml = avatarUrl
    ? `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display='none';this.nextSibling.style.display='flex'" /><div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(135deg,#FFFC00,#FF6B00);border-radius:50%;color:#1a1a2e;font-weight:800;font-size:20px">${name?.[0] || '?'}</div>`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#FFFC00,#FF6B00);border-radius:50%;color:#1a1a2e;font-weight:800;font-size:20px">${name?.[0] || '?'}</div>`;

  return L.divIcon({
    html: `
      <div style="position:relative;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.4))">
        <div style="width:52px;height:52px;border-radius:50%;border:3px solid ${isOnline ? '#00E676' : '#FFFC00'};overflow:hidden;background:#1a1a2e">
          ${avatarHtml}
        </div>
        ${statusDot}
        <div style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:11px;font-weight:700;color:white;text-shadow:0 1px 4px rgba(0,0,0,0.8);max-width:80px;overflow:hidden;text-overflow:ellipsis">${name}</div>
      </div>
    `,
    className: '',
    iconSize: [52, 72],
    iconAnchor: [26, 26],
  });
}

// "You" marker - blue pulsing dot like Snapchat
function createMyMarker() {
  return L.divIcon({
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center">
        <div style="position:absolute;width:40px;height:40px;border-radius:50%;background:rgba(0,122,255,0.2);animation:pulse 2s infinite"></div>
        <div style="width:20px;height:20px;border-radius:50%;background:#007AFF;border:3px solid white;box-shadow:0 2px 8px rgba(0,122,255,0.5);z-index:1"></div>
      </div>
      <style>@keyframes pulse{0%{transform:scale(1);opacity:0.7}70%{transform:scale(2);opacity:0}100%{transform:scale(2);opacity:0}}</style>
    `,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

export function FriendsMap() {
  const { user } = useAuth();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  
  const [friends, setFriends] = useState<FriendOnMap[]>([]);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sharing, setSharing] = useState(true);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();
  const [mapStyle, setMapStyle] = useState<MapStyle>(theme === 'dark' ? 'dark' : 'street');
  const [showStylePicker, setShowStylePicker] = useState(false);
  const battery = useBatterySaver();

  // Sync map style with global theme
  useEffect(() => {
    setMapStyle(theme === 'dark' ? 'dark' : 'street');
  }, [theme]);

  const fetchFriendsOnMap = useCallback(async () => {
    if (!user) return;

    try {
      // Get friend IDs
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_id_1, user_id_2')
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

      const friendIds = friendships?.map(f =>
        f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1
      ) || [];

      if (friendIds.length === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }

      // Fetch friend locations via security-definer RPC (latitude/longitude column SELECT is revoked on profiles)
      const { data: allFriendLocations } = await supabase.rpc('get_friend_locations');
      const profiles = (allFriendLocations || []).filter((p: any) => friendIds.includes(p.id));

      // Fetch presence data
      const { data: presenceData } = await supabase
        .from('user_presence')
        .select('user_id, status, last_seen')
        .in('user_id', friendIds);

      const presenceMap = new Map<string, { status: string; last_seen: string }>();
      presenceData?.forEach(p => {
        presenceMap.set(p.user_id, { status: p.status, last_seen: p.last_seen });
      });

      const mapped: FriendOnMap[] = (profiles || []).map(p => {
        const presence = presenceMap.get(p.id);
        return {
          user_id: p.id,
          first_name: p.first_name,
          profile_photo_url: p.profile_photo_url || undefined,
          latitude: Number(p.latitude),
          longitude: Number(p.longitude),
          presence_status: presence?.status || 'offline',
          last_seen: presence?.last_seen || undefined,
        };
      });

      setFriends(mapped);
    } catch (err) {
      console.error('Error fetching friends map data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFriendsOnMap();
  }, [fetchFriendsOnMap]);

  // Realtime subscriptions with unique channel name
  const fetchRef = useRef(fetchFriendsOnMap);
  fetchRef.current = fetchFriendsOnMap;

  useEffect(() => {
    if (!user) return;

    const channelName = `friends-map-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchRef.current();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, () => {
        fetchRef.current();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        fetchRef.current();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Watch own location and share it (battery-aware)
  useEffect(() => {
    if (!user || !sharing) return;

    let lastWriteAt = 0;
    const writeIntervalMs = battery.pollIntervalMs;

    const updateLocation = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      setMyLocation({ lat: latitude, lng: longitude });

      // Throttle DB writes to battery-aware cadence
      const now = Date.now();
      if (now - lastWriteAt < writeIntervalMs) return;
      lastWriteAt = now;

      supabase.from('profiles').update({
        latitude,
        longitude,
        location_updated_at: new Date().toISOString(),
      }).eq('id', user.id).then(({ error }) => {
        if (error) console.error('Error updating location:', error);
      });
    };

    const watchId = navigator.geolocation?.watchPosition(updateLocation, (err) => {
      console.warn('Geolocation error:', err);
    }, {
      enableHighAccuracy: !battery.saverActive,
      maximumAge: battery.maximumAgeMs,
      timeout: 15000,
    });

    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, [user, sharing, battery.saverActive, battery.pollIntervalMs, battery.maximumAgeMs]);

  const handleSharingToggle = async (enabled: boolean) => {
    setSharing(enabled);
    haptic(enabled ? 'success' : 'warning');
    if (!enabled && user) {
      await supabase.from('profiles').update({ ghost_mode: true }).eq('id', user.id);
      toastRef.current({ title: 'Location hidden', description: 'Friends can no longer see you on the map.' });
    } else if (user) {
      await supabase.from('profiles').update({ ghost_mode: false }).eq('id', user.id);
      toastRef.current({ title: 'Location visible', description: 'Friends can now see you on the map.' });
    }
  };

  const centerOnMe = () => {
    // Trigger re-render so FitBounds re-centers
    if (myLocation) {
      setMyLocation({ ...myLocation });
    }
  };

  const onlineFriends = friends.filter(f => f.presence_status === 'online');
  const center: [number, number] = myLocation
    ? [myLocation.lat, myLocation.lng]
    : friends.length > 0
      ? [friends[0].latitude, friends[0].longitude]
      : [20, 0];

  const getTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  if (loading) {
    return (
      <Card className="bg-card border-0">
        <CardContent className="p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading Snap Map...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full z-0 pointer-events-auto">
      {/* Floating Controls bar */}
      <div className="absolute top-48 sm:top-24 right-4 z-[1000] flex flex-col gap-3 items-end pointer-events-auto">
        <div className="glass px-4 py-2 rounded-full flex items-center gap-3 shadow-lg">
          {sharing ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
          <Label htmlFor="share-loc" className="text-sm cursor-pointer font-medium">Ghost Mode</Label>
          <Switch id="share-loc" checked={!sharing} onCheckedChange={(checked) => handleSharingToggle(!checked)} />
        </div>
      </div>

      {/* Edge-to-Edge Map */}
      <div className="w-full h-full relative">
        <MapContainer center={center} zoom={friends.length > 0 ? 12 : 3} className="w-full h-full z-0 bg-background" zoomControl={false}>
          <DynamicTileLayer style={mapStyle} />
          <FitBounds locations={friends} myLocation={myLocation} />

          {/* My location - blue dot */}
          {myLocation && sharing && (
            <Marker position={[myLocation.lat, myLocation.lng]} icon={createMyMarker()}>
              <Popup>
                <div className="text-center p-1">
                  <p className="font-bold text-sm">📍 You are here</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Friend markers - Snapchat style */}
          {friends.map(friend => (
            <Marker
              key={friend.user_id}
              position={[friend.latitude, friend.longitude]}
              icon={createSnapMarker(friend.first_name, friend.profile_photo_url, friend.presence_status === 'online')}
            >
              <Popup>
                <div className="flex items-center gap-3 p-2 min-w-[180px]">
                  <Avatar className="w-10 h-10 border-2 border-primary">
                    <AvatarImage src={friend.profile_photo_url} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold">{friend.first_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-sm">{friend.first_name}</p>
                    <p className="text-xs flex items-center gap-1">
                      {friend.presence_status === 'online' ? (
                        <><Wifi className="h-3 w-3 text-green-500" /> Online</>
                      ) : (
                        <><WifiOff className="h-3 w-3 text-gray-400" /> {getTimeAgo(friend.last_seen)}</>
                      )}
                    </p>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Map style picker - floating button */}
        <div className="absolute top-[350px] sm:top-40 right-4 z-[1000] pointer-events-auto">
          <Button
            size="icon"
            className="rounded-full w-12 h-12 shadow-lg glass hover:bg-muted/50 text-foreground transition-all duration-300"
            onClick={() => setShowStylePicker(prev => !prev)}
          >
            <Layers className="h-6 w-6" />
          </Button>

          {showStylePicker && (
            <div className="absolute top-14 right-0 glass rounded-2xl shadow-2xl p-2 flex flex-col gap-1 min-w-[140px] animate-in slide-in-from-top-2 duration-200">
              {(Object.keys(MAP_TILES) as MapStyle[]).map(key => (
                <button
                  key={key}
                  onClick={() => { haptic('selection'); setMapStyle(key); setShowStylePicker(false); }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    mapStyle === key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  {MAP_TILES[key].icon}
                  {MAP_TILES[key].label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center on me */}
        {myLocation && (
          <Button
            size="icon"
            className="absolute bottom-24 right-4 z-[1000] rounded-full w-14 h-14 shadow-2xl glass hover:bg-muted/50 text-foreground transition-all duration-300"
            onClick={centerOnMe}
          >
            <Navigation2 className="h-6 w-6" />
          </Button>
        )}
      </div>

      {/* Floating Friends list at the bottom */}
      <div className="absolute bottom-24 left-0 right-20 z-[1000] pointer-events-none">
        {friends.length > 0 && (
          <div className="overflow-x-auto pb-2 hide-scrollbar pointer-events-auto px-4">
            <div className="flex gap-4 min-w-min">
              {friends.map(friend => (
                <div key={friend.user_id} className="flex flex-col items-center gap-1 min-w-[72px]">
                  <div className="relative">
                    <Avatar className="w-16 h-16 border-4 shadow-xl" style={{ borderColor: friend.presence_status === 'online' ? '#00E676' : 'hsl(var(--border))' }}>
                      <AvatarImage src={friend.profile_photo_url} />
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xl">{friend.first_name?.[0]}</AvatarFallback>
                    </Avatar>
                    {friend.presence_status === 'online' && (
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-background shadow-sm" />
                    )}
                  </div>
                  <p className="text-xs font-bold truncate max-w-[80px] text-center drop-shadow-md bg-background/50 backdrop-blur-md px-2 py-0.5 rounded-full">{friend.first_name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
