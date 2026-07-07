import React, { useEffect, useState } from 'react';
import { Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { FriendsMap } from '@/components/FriendsMap';
import { SmartStatusChip } from '@/components/SmartStatusChip';
import { MobileBottomSheet } from '@/components/MobileBottomSheet';
import { TripSharingPanel } from '@/components/TripSharingPanel';
import EmergencyShareButton from '@/components/EmergencyShareButton';
import Messages from './Messages';
import Profile from './Profile';
import Friends from './Friends';
import { Loader2, Flame, Navigation as NavIcon, X, SlidersHorizontal, Users, MapPin } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

interface TripDest {
  name: string;
  lat: number;
  lng: number;
}

const Maps = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profileChecked, setProfileChecked] = useState(false);

  // Map filter state
  const [showFilters, setShowFilters] = useState(false);
  const [showFriends, setShowFriends] = useState(true);
  const [showFriendsBar, setShowFriendsBar] = useState(true);

  // Trip sheet + my location
  const [tripDest, setTripDest] = useState<TripDest | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const checkProfile = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, age')
          .eq('id', user.id)
          .maybeSingle();

        if (error) console.error('[Maps] Error checking profile:', error);

        if (!data || !data.first_name || !data.age) {
          navigate('/profile-setup');
        } else {
          setProfileChecked(true);
        }
      } catch (err) {
        console.error('[Maps] Profile check error:', err);
        setProfileChecked(true);
      }
    };

    if (user && !loading) checkProfile();
  }, [user, loading, navigate]);

  const currentSheet = searchParams.get('sheet');
  const memoryLaneActive = searchParams.get('memory') === '1';
  const isSheetOpen = !!currentSheet;
  const isTripOpen = !!tripDest;

  const closeSheet = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('sheet');
    setSearchParams(next);
  };

  const toggleMemoryLane = () => {
    haptic('selection');
    const next = new URLSearchParams(searchParams);
    if (memoryLaneActive) next.delete('memory');
    else next.set('memory', '1');
    setSearchParams(next);
  };

  if (!user && !loading) {
    return <Navigate to="/auth" replace />;
  }

  if (loading || (!profileChecked && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative bg-background overflow-hidden">
      <Navigation />

      {/* Floating header over the map */}
      <div className="absolute top-24 left-4 right-4 md:left-8 md:right-auto z-40 pointer-events-none">
        <div className="flex flex-col gap-4">
          <div className="bg-card/80 backdrop-blur-md p-4 rounded-2xl shadow-lg pointer-events-auto border">
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <NavIcon className="text-primary h-6 w-6" />
              Snap Map
            </h1>
            <p className="text-xs text-muted-foreground mt-1">Real-time friends location</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
            <button
              onClick={toggleMemoryLane}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold transition-all shadow-lg text-sm ${
                memoryLaneActive
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
              }`}
            >
              <Flame className={`w-4 h-4 ${memoryLaneActive ? 'text-white' : 'text-orange-500'}`} />
              <span>Memory Lane</span>
              {memoryLaneActive && <X className="w-3.5 h-3.5 ml-1 opacity-80" />}
            </button>

            {/* Filters button + popover */}
            <div className="relative">
              <button
                onClick={() => { haptic('selection'); setShowFilters(v => !v); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold transition-all shadow-lg text-sm ${
                  showFilters
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Filters</span>
              </button>

              {showFilters && (
                <div className="absolute top-14 left-0 z-[1002] bg-card/95 backdrop-blur-md border rounded-2xl shadow-2xl p-3 w-64 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <p className="text-xs font-bold uppercase text-muted-foreground tracking-wide px-1">
                    Map Layers
                  </p>
                  <div className="flex items-center justify-between px-1">
                    <Label htmlFor="f-friends" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                      <Users className="w-4 h-4 text-primary" /> Friend pins
                    </Label>
                    <Switch id="f-friends" checked={showFriends} onCheckedChange={(v) => { haptic('selection'); setShowFriends(v); }} />
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <Label htmlFor="f-bar" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                      <MapPin className="w-4 h-4 text-primary" /> Friends bar
                    </Label>
                    <Switch id="f-bar" checked={showFriendsBar} onCheckedChange={(v) => { haptic('selection'); setShowFriendsBar(v); }} />
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <Label htmlFor="f-memory" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                      <Flame className="w-4 h-4 text-orange-500" /> Memory Lane
                    </Label>
                    <Switch id="f-memory" checked={memoryLaneActive} onCheckedChange={toggleMemoryLane} />
                  </div>
                </div>
              )}
            </div>

            {/* Emergency share */}
            {user && (
              <EmergencyShareButton
                userLocation={myLocation ? [myLocation.lat, myLocation.lng] : null}
                userId={user.id}
              />
            )}
          </div>
        </div>
      </div>

      {/* Edge-to-edge Map Container */}
      <div className="absolute inset-0 z-0">
        <FriendsMap
          showMemoryLane={memoryLaneActive}
          showFriends={showFriends}
          showFriendsBar={showFriendsBar}
          onMyLocationChange={setMyLocation}
          onNavigateToFriend={(f) => {
            setTripDest({ name: `${f.first_name}'s location`, lat: f.latitude, lng: f.longitude });
          }}
        />
      </div>

      {/* Floating Memory Lane legend */}
      {memoryLaneActive && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-[1001] pointer-events-auto">
          <div className="bg-card/90 backdrop-blur-md border rounded-full shadow-xl px-4 py-2 flex items-center gap-3 text-xs">
            <span className="font-semibold flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-500" /> Last 30 days
            </span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Rare</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" />Some</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />Often</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />Hot</span>
          </div>
        </div>
      )}

      <div className="z-50 pointer-events-auto">
        <SmartStatusChip />
      </div>

      {/* Bottom Sheet Overlays */}
      <MobileBottomSheet
        isOpen={isSheetOpen}
        onClose={closeSheet}
        title={
          currentSheet === 'messages' ? 'Chat' :
          currentSheet === 'profile' ? 'Profile' :
          currentSheet === 'friends' ? 'Friends' : ''
        }
      >
        <div className="h-full overflow-hidden">
          {currentSheet === 'messages' && <Messages isOverlay={true} />}
          {currentSheet === 'profile' && <Profile isOverlay={true} />}
          {currentSheet === 'friends' && <Friends isOverlay={true} />}
        </div>
      </MobileBottomSheet>

      {/* Trip sharing sheet (opened from friend pin "On my way") */}
      <MobileBottomSheet
        isOpen={isTripOpen}
        onClose={() => setTripDest(null)}
        title="On my way"
      >
        <div className="p-4">
          <TripSharingPanel
            userLocation={myLocation}
            initialDestination={tripDest}
          />
        </div>
      </MobileBottomSheet>
    </div>
  );
};

export default Maps;
