import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { Map } from '@/components/MapboxMap';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, MapPin } from 'lucide-react';
import { ImageUpload } from '@/components/ImageUpload';

interface Profile {
  id: string;
  first_name: string;
  latitude: number | null;
  longitude: number | null;
  profile_photo_url: string | null;
  ghost_mode: boolean;
}

interface LiveLocation {
  user_id: string;
  latitude: number;
  longitude: number;
  avatar_url?: string;
  username?: string;
  updated_at: string;
}

const Maps = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [ghostMode, setGhostMode] = useState(false);
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const [bubbles, setBubbles] = useState<any[]>([]);

  // Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, latitude, longitude, profile_photo_url, ghost_mode')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setProfile(data);
          setGhostMode(data.ghost_mode || false);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  // Fetch live locations from bubble members
  useEffect(() => {
    const fetchLiveLocations = async () => {
      if (!user) return;

      try {
        // Get user's bubble memberships
        const { data: memberships, error: memberError } = await supabase
          .from('bubble_memberships')
          .select('bubble_id')
          .eq('user_id', user.id);

        if (memberError) throw memberError;

        const bubbleIds = memberships?.map(m => m.bubble_id) || [];

        if (bubbleIds.length > 0) {
          // Get all members from those bubbles
          const { data: allMembers } = await supabase
            .from('bubble_memberships')
            .select('user_id')
            .in('bubble_id', bubbleIds);

          const friendIds = allMembers ? [...new Set(allMembers.map(m => m.user_id))] : [];

          // Get their profiles with locations (excluding ghost mode users)
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, first_name, latitude, longitude, profile_photo_url, ghost_mode')
            .in('id', friendIds)
            .eq('ghost_mode', false)
            .not('latitude', 'is', null)
            .not('longitude', 'is', null);

          if (profilesError) throw profilesError;

          const locations: LiveLocation[] = profiles?.map(p => ({
            user_id: p.id,
            latitude: p.latitude!,
            longitude: p.longitude!,
            avatar_url: p.profile_photo_url || undefined,
            username: p.first_name,
            updated_at: new Date().toISOString(),
          })) || [];

          setLiveLocations(locations);
        }
      } catch (error) {
        console.error('Error fetching live locations:', error);
      }
    };

    fetchLiveLocations();

    // Set up realtime subscription
    const channel = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          fetchLiveLocations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Fetch bubbles
  useEffect(() => {
    const fetchBubbles = async () => {
      if (!user) return;

      try {
        const { data: memberships } = await supabase
          .from('bubble_memberships')
          .select('bubble_id')
          .eq('user_id', user.id);

        const bubbleIds = memberships?.map(m => m.bubble_id) || [];

        if (bubbleIds.length > 0) {
          const { data: bubblesData } = await supabase
            .from('bubbles')
            .select('id, name, latitude, longitude, interest_tag, member_count')
            .in('id', bubbleIds);

          setBubbles(bubblesData || []);
        }
      } catch (error) {
        console.error('Error fetching bubbles:', error);
      }
    };

    fetchBubbles();
  }, [user]);

  // Handle ghost mode toggle
  const handleGhostModeToggle = async (enabled: boolean) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ghost_mode: enabled })
        .eq('id', user.id);

      if (error) throw error;

      setGhostMode(enabled);
      toast({
        title: enabled ? 'Ghost Mode Enabled' : 'Ghost Mode Disabled',
        description: enabled 
          ? 'Your location is now hidden from others' 
          : 'Your location is now visible to friends',
      });
    } catch (error) {
      console.error('Error updating ghost mode:', error);
      toast({
        title: 'Error',
        description: 'Failed to update ghost mode',
        variant: 'destructive',
      });
    }
  };

  if (!user && !loading) {
    return <Navigate to="/auth" replace />;
  }

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-primary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const centerLocation: [number, number] | undefined = 
    profile?.latitude && profile?.longitude
      ? [profile.longitude, profile.latitude]
      : undefined;

  // Add current user to live locations if not in ghost mode
  const allLocations = [...liveLocations];
  if (profile?.latitude && profile?.longitude && !ghostMode) {
    allLocations.push({
      user_id: profile.id,
      latitude: profile.latitude,
      longitude: profile.longitude,
      avatar_url: profile.profile_photo_url || undefined,
      username: profile.first_name,
      updated_at: new Date().toISOString(),
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-primary">
      <Navigation profile={profile as any} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header with Profile Picture and Ghost Mode Toggle */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-4">
              <ImageUpload
                currentImageUrl={profile?.profile_photo_url || undefined}
                onImageUploaded={(url) => setProfile(prev => prev ? {...prev, profile_photo_url: url} : null)}
                userName={profile?.first_name || 'User'}
                className="flex-shrink-0"
              />
              <div>
                <h1 className="text-3xl font-bold mb-2">{profile?.first_name || 'Friend Finder Map'}</h1>
                <p className="text-muted-foreground">See your friends' locations and bubbles on the map</p>
              </div>
            </div>
            
            <Card className="backdrop-blur-sm bg-card/95 border-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {ghostMode ? (
                    <EyeOff className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Eye className="h-5 w-5 text-primary" />
                  )}
                  <div className="flex-1">
                    <Label htmlFor="ghost-mode" className="text-sm font-medium cursor-pointer">
                      Ghost Mode
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {ghostMode ? 'Location hidden' : 'Location visible'}
                    </p>
                  </div>
                  <Switch
                    id="ghost-mode"
                    checked={ghostMode}
                    onCheckedChange={handleGhostModeToggle}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Location Status */}
          {profile?.latitude && profile?.longitude && (
            <Card className="backdrop-blur-sm bg-card/95 border-0 mb-6">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-sm">
                    Your location: {profile.latitude.toFixed(4)}, {profile.longitude.toFixed(4)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Map */}
          <Card className="backdrop-blur-sm bg-card/95 border-0 overflow-hidden">
            <div className="h-[600px]">
              <Map
                bubbles={bubbles}
                showBubbles={true}
                center={centerLocation}
                liveLocations={allLocations}
                currentUserId={user?.id}
              />
            </div>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <Card className="backdrop-blur-sm bg-card/95 border-0">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{allLocations.length}</div>
                <p className="text-sm text-muted-foreground">Visible Friends</p>
              </CardContent>
            </Card>
            <Card className="backdrop-blur-sm bg-card/95 border-0">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{bubbles.length}</div>
                <p className="text-sm text-muted-foreground">Your Bubbles</p>
              </CardContent>
            </Card>
            <Card className="backdrop-blur-sm bg-card/95 border-0">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">
                  {ghostMode ? 'Hidden' : 'Visible'}
                </div>
                <p className="text-sm text-muted-foreground">Your Status</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Maps;
