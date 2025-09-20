import React, { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  Activity, 
  Users, 
  Clock,
  Loader2 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Map from '@/components/Map';

const PROXIMITY_METERS = 100;
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  // Haversine formula
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const Live = () => {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [userBubbles, setUserBubbles] = useState<any[]>([]);
  const [selectedBubble, setSelectedBubble] = useState<any>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [liveLocations, setLiveLocations] = useState<any[]>([]);
  const [privacyEnabled, setPrivacyEnabled] = useState(false);
  const [ghostMode, setGhostMode] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [geofenceAlert, setGeofenceAlert] = useState<string | null>(null);
  const [proximityAlert, setProximityAlert] = useState<string | null>(null);
  const [proximityRadius, setProximityRadius] = useState(PROXIMITY_METERS);
  const [locationTrail, setLocationTrail] = useState<{lat: number, lng: number, time: string}[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [chatLog, setChatLog] = useState<{user: string, message: string, time: string}[]>([]);
  const locationWatchId = useRef<number | null>(null);

  // Fetch profile and bubbles
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(profileData);
        const { data: bubblesData } = await supabase
          .from('bubble_memberships')
          .select(`bubble:bubbles(*)`)
          .eq('user_id', user.id);
        const bubbles = bubblesData?.map(m => m.bubble).filter(Boolean) || [];
        setUserBubbles(bubbles);
        if (bubbles.length > 0) setSelectedBubble(bubbles[0]);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setPageLoading(false);
      }
    };
    if (user && !loading) fetchData();
  }, [user, loading]);

  // Publish current user's location to live_locations
  useEffect(() => {
    if (!user || !selectedBubble || privacyEnabled || ghostMode) return;
    let isMounted = true;
    const publishLocation = async (lat: number, lng: number) => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry
      await supabase.from('live_locations').upsert({
        user_id: user.id,
        bubble_id: selectedBubble.id,
        latitude: lat,
        longitude: lng,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,bubble_id' });
      setLocationTrail(trail => [...trail, {lat, lng, time: new Date().toISOString()}]);
      // Geofencing demo: alert if inside a 200m radius of bubble center
      const dist = getDistanceMeters(lat, lng, selectedBubble.latitude, selectedBubble.longitude);
      if (dist < 200) {
        setGeofenceAlert(`You entered the bubble zone! (${dist.toFixed(0)}m from center)`);
      } else {
        setGeofenceAlert(null);
      }
    };
    if (navigator.geolocation) {
      locationWatchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (isMounted) publishLocation(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => { console.warn('Location error:', err); },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
      );
    }
    return () => {
      isMounted = false;
      if (locationWatchId.current !== null) {
        navigator.geolocation.clearWatch(locationWatchId.current);
      }
    };
  }, [user, selectedBubble, privacyEnabled, ghostMode]);

  // Proximity alert effect
  useEffect(() => {
    if (!user) return;
    const me = liveLocations.find(l => l.user_id === user.id);
    if (!me) return;
    let found = null;
    for (const loc of liveLocations) {
      if (loc.user_id !== user.id) {
        const dist = getDistanceMeters(me.latitude, me.longitude, loc.latitude, loc.longitude);
        if (dist < proximityRadius) {
          found = loc;
          break;
        }
      }
    }
    if (found) {
      setProximityAlert(`User nearby: ${found.user_name || found.user_id} is within ${proximityRadius} meters!`);
    } else {
      setProximityAlert(null);
    }
  }, [liveLocations, user]);

  // Subscribe to live_locations for selected bubble
  useEffect(() => {
    if (!selectedBubble) return;
    let subscription: any;
    const fetchLiveLocations = async () => {
      const { data } = await supabase
        .from('live_locations')
        .select('*')
        .eq('bubble_id', selectedBubble.id)
        .gte('expires_at', new Date().toISOString());
      setLiveLocations(data || []);
    };
    fetchLiveLocations();
    subscription = supabase
      .channel('live_locations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_locations', filter: `bubble_id=eq.${selectedBubble.id}` },
        (payload) => { fetchLiveLocations(); }
      )
      .subscribe();
    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [selectedBubble]);

  if (!user && !loading) {
    return <Navigate to="/auth" replace />;
  }

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-primary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-primary">
      <Navigation profile={profile} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">
              Live Features
              <Activity className="inline-block ml-2 h-8 w-8 text-primary" />
            </h1>
            <p className="text-lg text-muted-foreground">
              Real-time location sharing, status updates, and live interactions
            </p>
          </div>

          {userBubbles.length === 0 ? (
            <Card className="backdrop-blur-sm bg-card/95 border-0">
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No bubbles joined</h3>
                <p className="text-muted-foreground mb-4">
                  Join a bubble to access live features and real-time interactions
                </p>
                <Button onClick={() => window.location.href = '/'}>
                  Find Bubbles
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Bubble Selector */}
              <Card className="backdrop-blur-sm bg-card/95 border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Your Bubbles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {userBubbles.map((bubble) => (
                      <Button
                        key={bubble.id}
                        variant={selectedBubble?.id === bubble.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedBubble(bubble)}
                        className="flex items-center gap-2"
                      >
                        <Badge variant="secondary" className="text-xs">
                          {bubble.interest_tag}
                        </Badge>
                        {bubble.name}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {selectedBubble && (
                <Tabs defaultValue="map" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="map" className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Live Map
                    </TabsTrigger>
                    <TabsTrigger value="status" className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Status Updates
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Live Activity
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="map">
                    <Card className="backdrop-blur-sm bg-card/95 border-0">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          Real-time Location Sharing - {selectedBubble.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <div className="bg-primary/10 rounded-lg p-4 flex-1">
                              <p className="text-sm text-muted-foreground mb-2">
                                <strong>Note:</strong> Live location sharing requires database updates that will be available after the next deployment.
                              </p>
                              <p className="text-sm text-muted-foreground">
                                This feature allows you to share your real-time location with bubble members and see who's nearby.
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2 items-center">
                                <label htmlFor="proximityRadius" className="text-xs font-medium">Proximity Radius:</label>
                                <input
                                  id="proximityRadius"
                                  type="number"
                                  min={10}
                                  max={1000}
                                  value={proximityRadius}
                                  onChange={e => setProximityRadius(Number(e.target.value))}
                                  className="border rounded px-2 py-1 w-20 text-xs"
                                />
                                <span className="text-xs">meters</span>
                                <Button
                                  variant={ghostMode ? 'secondary' : 'outline'}
                                  size="sm"
                                  onClick={() => setGhostMode(v => !v)}
                                >
                                  {ghostMode ? 'Disable Ghost Mode' : 'Enable Ghost Mode'}
                                </Button>
                                <Button
                                  variant={heatmapEnabled ? 'secondary' : 'outline'}
                                  size="sm"
                                  onClick={() => setHeatmapEnabled(v => !v)}
                                >
                                  {heatmapEnabled ? 'Disable Heatmap' : 'Show Heatmap'}
                                </Button>
                              </div>
                              {geofenceAlert && (
                                <div className="text-xs text-blue-600 font-semibold bg-blue-100 rounded px-2 py-1 mt-2">
                                  {geofenceAlert}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-2 items-end">
                              <Button
                                variant={privacyEnabled ? 'destructive' : 'secondary'}
                                size="sm"
                                onClick={() => setPrivacyEnabled(v => !v)}
                              >
                                {privacyEnabled ? 'Enable Location Sharing' : 'Pause Location Sharing'}
                              </Button>
                              {proximityAlert && (
                                <div className="text-sm text-red-600 font-semibold bg-red-100 rounded px-2 py-1 mt-1">
                                  {proximityAlert}
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Location Trail/History */}
                          {locationTrail.length > 1 && (
                            <div className="bg-muted/30 rounded-lg p-2 mt-2">
                              <div className="font-semibold text-xs mb-1">Your Location Trail (last 10):</div>
                              <ol className="text-xs list-decimal ml-4">
                                {locationTrail.slice(-10).map((pt, idx) => (
                                  <li key={idx}>
                                    {pt.lat.toFixed(5)}, {pt.lng.toFixed(5)} <span className="text-muted-foreground">({new Date(pt.time).toLocaleTimeString()})</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}
                          {/* Location-based Chat/Notification */}
                          <div className="bg-muted/20 rounded-lg p-2 mt-2">
                            <div className="font-semibold text-xs mb-1">Bubble Chat (demo):</div>
                            <div className="space-y-1 max-h-24 overflow-y-auto mb-2">
                              {chatLog.slice(-10).map((msg, idx) => (
                                <div key={idx} className="text-xs"><span className="font-bold">{msg.user}:</span> {msg.message} <span className="text-muted-foreground">({new Date(msg.time).toLocaleTimeString()})</span></div>
                              ))}
                            </div>
                            <form
                              onSubmit={e => {
                                e.preventDefault();
                                if (chatMessage.trim()) {
                                  setChatLog(log => [...log, {user: profile?.first_name || 'You', message: chatMessage, time: new Date().toISOString()}]);
                                  setChatMessage("");
                                }
                              }}
                              className="flex gap-2"
                            >
                              <input
                                type="text"
                                value={chatMessage}
                                onChange={e => setChatMessage(e.target.value)}
                                className="border rounded px-2 py-1 text-xs flex-1"
                                placeholder="Type a message..."
                              />
                              <Button type="submit" size="sm" variant="secondary">Send</Button>
                            </form>
                          </div>
                          {/* Location Trail/History */}
                          {locationTrail.length > 1 && (
                            <div className="bg-muted/30 rounded-lg p-2 mt-2">
                              <div className="font-semibold text-xs mb-1">Your Location Trail (last 10):</div>
                              <ol className="text-xs list-decimal ml-4">
                                {locationTrail.slice(-10).map((pt, idx) => (
                                  <li key={idx}>
                                    {pt.lat.toFixed(5)}, {pt.lng.toFixed(5)} <span className="text-muted-foreground">({new Date(pt.time).toLocaleTimeString()})</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}
                          <Map
                            bubbles={[selectedBubble]}
                            showBubbles={true}
                            center={[selectedBubble.longitude, selectedBubble.latitude]}
                            liveLocations={liveLocations}
                            currentUserId={user?.id}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="status">
                    <Card className="backdrop-blur-sm bg-card/95 border-0">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Activity className="h-5 w-5" />
                          Status Updates - {selectedBubble.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="bg-primary/10 rounded-lg p-4">
                            <p className="text-sm text-muted-foreground mb-2">
                              <strong>Coming Soon:</strong> Share your current activity and status with bubble members.
                            </p>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-4">
                              {['☕ Coffee', '💼 Working', '🎵 Music', '🎮 Gaming', '📚 Reading', '😊 Available'].map((status) => (
                                <Button key={status} variant="outline" size="sm" disabled>
                                  {status}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="activity">
                    <Card className="backdrop-blur-sm bg-card/95 border-0">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Clock className="h-5 w-5" />
                          Live Activity Feed - {selectedBubble.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="bg-primary/10 rounded-lg p-4">
                            <p className="text-sm text-muted-foreground mb-2">
                              <strong>Live Activity:</strong> See who's online, who's sharing location, and recent activities in real-time.
                            </p>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              <div>
                                <p className="font-medium">{profile?.first_name} (You)</p>
                                <p className="text-sm text-muted-foreground">Online • Last seen now</p>
                              </div>
                            </div>
                            
                            <div className="text-center py-8">
                              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                              <p className="text-muted-foreground">More live activity features coming soon!</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Live;