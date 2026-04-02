import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MapPin, Eye, EyeOff, Users, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FriendOnMap {
  user_id: string;
  first_name: string;
  profile_photo_url?: string;
  latitude: number;
  longitude: number;
  presence_status?: string;
  last_seen?: string;
}

function FitBounds({ locations }: { locations: FriendOnMap[] }) {
  const map = useMap();
  useEffect(() => {
    if (locations.length === 0) return;
    const bounds = L.latLngBounds(locations.map(l => [l.latitude, l.longitude]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }, [locations, map]);
  return null;
}

function createFriendIcon(avatarUrl?: string, isOnline?: boolean) {
  const borderColor = isOnline ? '#22c55e' : '#6b7280';
  if (avatarUrl) {
    return L.divIcon({
      html: `<div style="position:relative">
        <div style="width:44px;height:44px;border-radius:50%;border:3px solid ${borderColor};overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
          <img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover" />
        </div>
        ${isOnline ? '<div style="position:absolute;bottom:0;right:0;width:12px;height:12px;background:#22c55e;border-radius:50%;border:2px solid #0a0a0a"></div>' : ''}
      </div>`,
      className: '',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  }
  return L.divIcon({
    html: `<div style="position:relative">
      <div style="width:44px;height:44px;border-radius:50%;border:3px solid ${borderColor};background:hsl(var(--primary));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">?</div>
      ${isOnline ? '<div style="position:absolute;bottom:0;right:0;width:12px;height:12px;background:#22c55e;border-radius:50%;border:2px solid #0a0a0a"></div>' : ''}
    </div>`,
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

export function FriendsMap() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [friends, setFriends] = useState<FriendOnMap[]>([]);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sharing, setSharing] = useState(true);
  const [loading, setLoading] = useState(true);

  // Fetch friends with their locations and presence
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

      // Fetch profiles with location (non-ghost)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, profile_photo_url, latitude, longitude, ghost_mode')
        .in('id', friendIds)
        .eq('ghost_mode', false)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      // Fetch presence data
      const { data: presenceData } = await supabase
        .from('user_presence')
        .select('user_id, status, last_seen')
        .in('user_id', friendIds);

      const presenceMap = new Map(presenceData?.map(p => [p.user_id, p]) || []);

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

  // Realtime subscriptions for profiles (location changes) and presence
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('friends-map-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchFriendsOnMap();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, () => {
        fetchFriendsOnMap();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        fetchFriendsOnMap();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchFriendsOnMap]);

  // Update own location periodically
  useEffect(() => {
    if (!user || !sharing) return;

    const updateLocation = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      setMyLocation({ lat: latitude, lng: longitude });

      supabase.from('profiles').update({
        latitude,
        longitude,
        location_updated_at: new Date().toISOString(),
      }).eq('id', user.id);
    };

    const watchId = navigator.geolocation?.watchPosition(updateLocation, console.warn, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 15000,
    });

    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, [user, sharing]);

  const handleSharingToggle = async (enabled: boolean) => {
    setSharing(enabled);
    if (!enabled && user) {
      await supabase.from('profiles').update({ ghost_mode: true }).eq('id', user.id);
      toast({ title: 'Location hidden', description: 'Friends can no longer see you on the map.' });
    } else if (user) {
      await supabase.from('profiles').update({ ghost_mode: false }).eq('id', user.id);
      toast({ title: 'Location visible', description: 'Friends can now see you on the map.' });
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
      <Card className="backdrop-blur-sm bg-card/95 border-0">
        <CardContent className="p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading friends map...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Friends on Map
          </h2>
          <Badge variant="secondary" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {onlineFriends.length} online
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {sharing ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
          <Label htmlFor="share-loc" className="text-sm cursor-pointer">Share my location</Label>
          <Switch id="share-loc" checked={sharing} onCheckedChange={handleSharingToggle} />
        </div>
      </div>

      {/* Map */}
      <Card className="backdrop-blur-sm bg-card/95 border-0 overflow-hidden">
        <div className="h-[500px]">
          <MapContainer center={center} zoom={friends.length > 0 ? 10 : 3} className="w-full h-full z-0" zoomControl={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {friends.length > 0 && <FitBounds locations={friends} />}

            {/* My location marker */}
            {myLocation && sharing && (
              <Marker
                position={[myLocation.lat, myLocation.lng]}
                icon={L.divIcon({
                  html: `<div style="width:18px;height:18px;border-radius:50%;background:hsl(var(--primary));border:3px solid white;box-shadow:0 0 12px rgba(59,130,246,0.5)"></div>`,
                  className: '',
                  iconSize: [18, 18],
                  iconAnchor: [9, 9],
                })}
              >
                <Popup><strong>You</strong></Popup>
              </Marker>
            )}

            {/* Friend markers */}
            {friends.map(friend => (
              <Marker
                key={friend.user_id}
                position={[friend.latitude, friend.longitude]}
                icon={createFriendIcon(friend.profile_photo_url, friend.presence_status === 'online')}
              >
                <Popup>
                  <div className="flex items-center gap-2 p-1 min-w-[150px]">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={friend.profile_photo_url} />
                      <AvatarFallback>{friend.first_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm">{friend.first_name}</p>
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
        </div>
      </Card>

      {/* Friends list sidebar */}
      {friends.length === 0 ? (
        <Card className="backdrop-blur-sm bg-card/95 border-0">
          <CardContent className="p-8 text-center">
            <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No friends sharing their location yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="backdrop-blur-sm bg-card/95 border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Friends Nearby</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {friends.map(friend => (
                <div key={friend.user_id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <div className="relative">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={friend.profile_photo_url} />
                      <AvatarFallback className="text-xs">{friend.first_name?.[0]}</AvatarFallback>
                    </Avatar>
                    {friend.presence_status === 'online' && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{friend.first_name}</p>
                    <p className="text-xs text-muted-foreground">{getTimeAgo(friend.last_seen)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
