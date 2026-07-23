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
  Loader2,
  Package,
  Route,
  Zap,
  BatteryLow
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';
import { Map } from '@/components/Map';
import CreateStoryDialog from '@/components/CreateStoryDialog';
import CreateEventDialog from '@/components/CreateEventDialog';
import CreateARPinDialog from '@/components/CreateARPinDialog';
import EmergencyShareButton from '@/components/EmergencyShareButton';
import PrivacyScheduleDialog from '@/components/PrivacyScheduleDialog';
import { DeadDropPanel } from '@/components/DeadDropPanel';
import { TripSharingPanel } from '@/components/TripSharingPanel';
import { HangoutZonePanel } from '@/components/HangoutZonePanel';
import { useBatterySaver } from '@/hooks/useBatterySaver';
import { useHapticFeedback, hapticPatterns } from '@/hooks/useHapticFeedback';
import { useSafetyMonitor } from '@/hooks/useSafetyMonitor';

type UserBadgeRow = {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
};

type BadgeRow = {
  id: string;
  name: string;
  icon: string;
  description: string;
  created_at: string;
};

type UserBadgeWithBadge = UserBadgeRow & {
  badges: BadgeRow;
};

type Location = Database['public']['Tables']['live_locations']['Row'];

type ActivityUpdate = {
  user_id: string;
  activity_type: string;
  updated_at: string;
};

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
  const batterySaver = useBatterySaver();
  const haptic = useHapticFeedback();

  // Safety monitor — watches for unusual stillness
  useSafetyMonitor({ userId: user?.id });

  // State declarations
  const [profile, setProfile] = useState<Database['public']['Tables']['profiles']['Row'] | null>(null);
  const [userBubbles, setUserBubbles] = useState<Database['public']['Tables']['bubbles']['Row'][]>([]);
  const [selectedBubble, setSelectedBubble] = useState<Database['public']['Tables']['bubbles']['Row'] | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  // BUG-024: bumped after the in-map "Create Event/Bubble" dialog persists a
  // new bubble, so the user's bubble list (and the map's in-view bubbles)
  // reflects it without needing a manual reload.
  const [bubbleRefreshKey, setBubbleRefreshKey] = useState(0);
  const [liveLocations, setLiveLocations] = useState<Location[]>([]);
  const [bubbleActivity, setBubbleActivity] = useState<ActivityUpdate[]>([]);
  const [activityStatus, setActivityStatus] = useState<string>('Online');
  const [privacyEnabled, setPrivacyEnabled] = useState(false);
  const [ghostMode, setGhostMode] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [geofenceAlert, setGeofenceAlert] = useState<string | null>(null);
  const [proximityAlert, setProximityAlert] = useState<string | null>(null);
  const [proximityRadius, setProximityRadius] = useState(PROXIMITY_METERS);
  const [locationTrail, setLocationTrail] = useState<{lat: number, lng: number, time: string}[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [chatLog, setChatLog] = useState<{user: string, message: string, time: string}[]>([]);
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false);
  const [privacySchedule, setPrivacySchedule] = useState<{ start: string; end: string } | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<UserBadgeWithBadge[]>([]);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [arPinDialogOpen, setArPinDialogOpen] = useState(false);
  const [storyDialogOpen, setStoryDialogOpen] = useState(false);

  // Refs
  const locationWatchId = useRef<number | null>(null);
  const chatChannelRef = useRef<RealtimeChannel | null>(null);
  const prevProximityAlert = useRef<string | null>(null);

  // Detect activity using device sensors (demo: use geolocation speed)
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const speed = pos.coords.speed || 0;
        let status = 'Online';
        if (speed > 8) status = 'Driving';
        else if (speed > 1.5) status = 'Walking';
        else status = 'At Venue';
        setActivityStatus(status);
        // Update status in Supabase
        if (user && selectedBubble) {
          supabase.from('status_updates').upsert({
            user_id: user.id,
            bubble_id: selectedBubble.id,
            activity_type: status,
            updated_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            status_text: status,
          }, { onConflict: 'user_id,bubble_id' });
        }
      },
      (err) => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [user, selectedBubble]);

  // Fetch activity status for all users in bubble
  useEffect(() => {
    if (!selectedBubble) return;
    const fetchActivity = async () => {
      const { data } = await supabase
        .from('status_updates')
        .select('user_id,activity_type,updated_at')
        .eq('bubble_id', selectedBubble.id)
        .gte('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()); // last 10 min
      setBubbleActivity(data || []);
    };
    fetchActivity();
    const interval = setInterval(fetchActivity, 15000);
    return () => clearInterval(interval);
  }, [selectedBubble]);

  // Fetch profile and bubbles
  // Fetch privacy schedule for user
  useEffect(() => {
    if (!user) return;
    const fetchSchedule = async () => {
      try {
        const { data, error } = await supabase
          .from('privacy_schedules')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data) {
          setPrivacySchedule({ start: data.start_time, end: data.end_time });
        }
      } catch (error) {
        // Silently handle error for non-existent table
        console.warn('Privacy schedule fetch error:', error);
      }
    };
    fetchSchedule();
  }, [user]);
  // Fetch earned badges for user
  useEffect(() => {
    if (!user) return;
    const fetchBadges = async () => {
      // Fetch user_badges
      const { data: userBadgesData } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', user.id);

      if (!userBadgesData || userBadgesData.length === 0) {
        setEarnedBadges([]);
        return;
      }

      // Extract badge_ids
      const badgeIds = userBadgesData.map(ub => ub.badge_id);

      // Fetch corresponding badges
      const { data: badgesData } = await supabase
        .from('badges')
        .select('*')
        .in('id', badgeIds);

      // Create map of badge_id to badge
      const badgesMap: Record<string, BadgeRow> = {};
      badgesData?.forEach(badge => {
        badgesMap[badge.id] = badge;
      });

      // Map user_badges with badges
      const enrichedBadges: UserBadgeWithBadge[] = userBadgesData.map(ub => ({
        ...ub,
        badges: badgesMap[ub.badge_id] || { id: '', name: 'Unknown', icon: '', description: '', created_at: '' }
      }));

      setEarnedBadges(enrichedBadges);
    };
    fetchBadges();
    const interval = setInterval(fetchBadges, 30000);
    return () => clearInterval(interval);
  }, [user]);
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          return;
        }
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
  }, [user, loading, bubbleRefreshKey]);

  // Publish current user's location to live_locations
  useEffect(() => {
    if (!user || !selectedBubble) return;
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

      // Location-based rewards: award badge for visiting new places
      const { data: badges } = await supabase.from('badges').select('*');
      const { data: userBadges } = await supabase.from('user_badges').select('badge_id').eq('user_id', user.id);
      // Example: award "Explorer" badge if user visits a location > 2km from bubble center
      if (dist > 2000 && badges) {
        const explorerBadge = badges.find(b => b.name === 'Explorer');
        const alreadyEarned = userBadges?.some(ub => ub.badge_id === explorerBadge?.id);
        if (explorerBadge && !alreadyEarned) {
          await supabase.from('user_badges').insert({
            user_id: user.id,
            badge_id: explorerBadge.id,
            earned_at: new Date().toISOString(),
          });
        }
      }
    };
    if (navigator.geolocation) {
      locationWatchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (isMounted) publishLocation(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => { console.warn('Location error:', err); },
        {
          enableHighAccuracy: !batterySaver.saverActive,
          maximumAge: batterySaver.maximumAgeMs,
          timeout: 20000
        }
      );
    }
    return () => {
      isMounted = false;
      if (locationWatchId.current !== null) {
        navigator.geolocation.clearWatch(locationWatchId.current);
      }
    };
  }, [user, selectedBubble, privacyEnabled, ghostMode]);

  // Proximity alert effect with haptic feedback
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
    const newAlert = found ? `User nearby! Someone is within ${proximityRadius}m of you.` : null;
    // Fire haptic only when alert first appears
    if (newAlert && !prevProximityAlert.current) {
      navigator.vibrate?.(hapticPatterns.friendNearby);
    }
    prevProximityAlert.current = newAlert;
    setProximityAlert(newAlert);
  }, [liveLocations, user, proximityRadius]);


  // Subscribe to live_locations for selected bubble
  useEffect(() => {
    if (!selectedBubble) return;
    const fetchLiveLocations = async () => {
      const { data } = await supabase
        .from('live_locations')
        .select('*')
        .eq('bubble_id', selectedBubble.id)
        .gte('expires_at', new Date().toISOString());
      setLiveLocations(data || []);
    };
    fetchLiveLocations();
    const channel = supabase
      .channel(`live_locations-${selectedBubble.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_locations', filter: `bubble_id=eq.${selectedBubble.id}` },
        () => { fetchLiveLocations(); }
      );
    // subscribe explicitly and keep channel reference for cleanup
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedBubble]);

  // Subscribe to chat messages for the selected bubble using Supabase Broadcast
  useEffect(() => {
    if (!selectedBubble) return;
    // Clean up any existing channel
    if (chatChannelRef.current) {
      supabase.removeChannel(chatChannelRef.current);
    }
    const chatChannel = supabase.channel(`bubble-chat-${selectedBubble.id}`);
    chatChannel.on('broadcast', { event: 'chat' }, (payload) => {
      const msg = payload.payload?.message;
      if (msg && msg.user && msg.message && msg.time) {
        setChatLog((log) => [...log, msg]);
      }
    });
    chatChannel.subscribe();
    chatChannelRef.current = chatChannel;
    return () => {
      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current);
        chatChannelRef.current = null;
      }
    };
  }, [selectedBubble]);

  if (!user && !loading) {
    return <Navigate to="/auth" replace />;
  }

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
  <div className="min-h-screen">
      <Navigation />
      {/* Location-based Story Dialog */}
      <CreateStoryDialog
        open={storyDialogOpen}
        onClose={() => setStoryDialogOpen(false)}
        userLocation={(() => {
          const me = liveLocations.find(l => l.user_id === user?.id);
          return me ? [me.latitude, me.longitude] : null;
        })()}
      />
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
                  {/* Battery saver indicator */}
                  {batterySaver.saverActive && (
                    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-lg px-3 py-2">
                      <BatteryLow className="h-3.5 w-3.5" />
                      <span>Battery Saver: GPS polling reduced to every {Math.round(batterySaver.pollIntervalMs / 1000)}s</span>
                    </div>
                  )}
                  <TabsList className="grid w-full grid-cols-6 text-xs">
                    <TabsTrigger value="map" className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Map</span>
                    </TabsTrigger>
                    <TabsTrigger value="status" className="flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Status</span>
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Activity</span>
                    </TabsTrigger>
                    <TabsTrigger value="drops" className="flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Drops</span>
                    </TabsTrigger>
                    <TabsTrigger value="trip" className="flex items-center gap-1">
                      <Route className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Trip</span>
                    </TabsTrigger>
                    <TabsTrigger value="hangout" className="flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Zone</span>
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
                          {/* Post Story & Create Event Buttons */}
                          <div className="flex justify-end mb-2 gap-2">
                            <Button variant="default" size="sm" onClick={() => setStoryDialogOpen(true)}>
                              Post a Story
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => setEventDialogOpen(true)}>
                              Create Event
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setArPinDialogOpen(true)}>
                              Drop AR Pin
                            </Button>
                          </div>
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
                          {/* Emergency Share & Privacy Scheduling */}
                          <div className="flex justify-end mb-2 gap-2">
                            <EmergencyShareButton
                              userLocation={(() => {
                                const me = liveLocations.find(l => l.user_id === user?.id);
                                return me ? [me.latitude, me.longitude] : null;
                              })()}
                              userId={user?.id || ''}
                            />
                            <Button variant="outline" size="sm" onClick={() => setPrivacyDialogOpen(true)}>
                              Privacy Schedule
                            </Button>
                          </div>
                          <PrivacyScheduleDialog
                            open={privacyDialogOpen}
                            onClose={() => setPrivacyDialogOpen(false)}
                            userId={user?.id || ''}
                            initialSchedule={privacySchedule}
                          />
                          {earnedBadges.length > 0 && (
                            <div className="bg-yellow-50 rounded-lg p-2 mt-2 flex flex-wrap gap-2 items-center">
                              <div className="font-semibold text-xs mb-1">Your Badges:</div>
                              {earnedBadges.map((ub, idx) => (
                                <div key={ub.badge_id || idx} className="flex items-center gap-1 px-2 py-1 bg-yellow-100 rounded shadow text-xs">
                                  {ub.badges?.icon && <span>{ub.badges.icon}</span>}
                                  <span className="font-bold">{ub.badges?.name}</span>
                                  {ub.badges?.description && <span className="text-muted-foreground">({ub.badges.description})</span>}
                                </div>
                              ))}
                            </div>
                          )}
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
                                  const msg = {user: profile?.first_name || 'You', message: chatMessage, time: new Date().toISOString()};
                                  // Broadcast-only channels don't echo back to the sender by
                                  // default (BUG-012 — this composer previously only ever
                                  // updated local state, so no other bubble member ever saw
                                  // it), so append locally and broadcast for everyone else.
                                  setChatLog(log => [...log, msg]);
                                  chatChannelRef.current?.send({ type: 'broadcast', event: 'chat', payload: { message: msg } });
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

                          {/* BUG-024 investigation: Map's own root div sets
                              `height: '100%'`, but CSS only resolves a
                              percentage height against an ancestor with an
                              explicit (non-auto, non-percentage) height — none
                              of Map's ancestors here have one, so it was
                              silently collapsing to ~20px of shrink-to-fit
                              content (Leaflet's attribution line, which is
                              the only in-flow content — tiles/markers are all
                              absolutely positioned and invisible in a 20px
                              box). That made every map interaction on this
                              tab — clicking to place a bubble, viewing
                              markers, drawing tools — effectively unusable.
                              An explicit pixel height here breaks the
                              percentage chain. */}
                          <div style={{ height: 500 }}>
                            <Map
                              bubbles={[selectedBubble]}
                              showBubbles={true}
                              center={[selectedBubble.latitude, selectedBubble.longitude]}
                              liveLocations={liveLocations}
                              currentUserId={user?.id}
                              onBubbleCreated={() => setBubbleRefreshKey(k => k + 1)}
                              showARPins={true}
                              showStories={true}
                              storyRadius={1000}
                            />
                          </div>
                          <CreateARPinDialog
                            open={arPinDialogOpen}
                            onClose={() => setArPinDialogOpen(false)}
                            userLocation={(() => {
                              const me = liveLocations.find(l => l.user_id === user?.id);
                              return me ? [me.latitude, me.longitude] : null;
                            })()}
                          />
                          {/* Event Creation Dialog */}
                          <CreateEventDialog
                            open={eventDialogOpen}
                            onClose={() => setEventDialogOpen(false)}
                            userLocation={(() => {
                              const me = liveLocations.find(l => l.user_id === user?.id);
                              return me ? [me.latitude, me.longitude] : null;
                            })()}
                            bubbleId={selectedBubble?.id}
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
                              <strong>Live Activity:</strong> See what friends are doing right now (walking, driving, at a venue).
                            </p>
                          </div>
                          <div className="space-y-3">
                            {bubbleActivity.length === 0 && (
                              <div className="text-center py-8">
                                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                <p className="text-muted-foreground">No recent activity yet.</p>
                              </div>
                            )}
                            {bubbleActivity.map((act, idx) => (
                              <div key={act.user_id || idx} className="flex items-center p-3 bg-muted/50 rounded-lg">
                                <div>
                                  <p className="font-medium">User{act.user_id === user?.id ? ' (You)' : ''}</p>
                                  <p className="text-sm text-muted-foreground">{act.activity_type} • Last seen {new Date(act.updated_at).toLocaleTimeString()}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* ── Dead Drops ── */}
                  <TabsContent value="drops">
                    <Card className="backdrop-blur-sm bg-card/95 border-0">
                      <CardContent className="pt-6">
                        <DeadDropPanel
                          userLocation={(() => {
                            const me = liveLocations.find(l => l.user_id === user?.id);
                            return me ? { lat: me.latitude, lng: me.longitude } : null;
                          })()}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* ── Trip Sharing ── */}
                  <TabsContent value="trip">
                    <Card className="backdrop-blur-sm bg-card/95 border-0">
                      <CardContent className="pt-6">
                        <TripSharingPanel
                          userLocation={(() => {
                            const me = liveLocations.find(l => l.user_id === user?.id);
                            return me ? { lat: me.latitude, lng: me.longitude } : null;
                          })()}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* ── Hangout Zones ── */}
                  <TabsContent value="hangout">
                    <Card className="backdrop-blur-sm bg-card/95 border-0">
                      <CardContent className="pt-6">
                        <HangoutZonePanel
                          bubbleId={selectedBubble.id}
                          userLocation={(() => {
                            const me = liveLocations.find(l => l.user_id === user?.id);
                            return me ? { lat: me.latitude, lng: me.longitude } : null;
                          })()}
                        />
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