import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Clock, Navigation as NavigationIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import Map from '@/components/Map';

interface LiveLocationSharingProps {
  bubbleId: string;
}

interface LiveLocation {
  user_id: string;
  profile: {
    first_name: string;
    profile_photo_url: string | null;
  };
  latitude: number;
  longitude: number;
  updated_at: string;
  expires_at: string;
}

export const LiveLocationSharing: React.FC<LiveLocationSharingProps> = ({ bubbleId }) => {
  const [isSharing, setIsSharing] = useState(false);
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const [shareExpiry, setShareExpiry] = useState<Date | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    checkExistingShare();
    fetchLiveLocations();
    
    // Set up real-time subscription for live locations
    const channel = supabase
      .channel(`live-locations-${bubbleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_locations',
          filter: `bubble_id=eq.${bubbleId}`,
        },
        () => {
          fetchLiveLocations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bubbleId]);

  const checkExistingShare = async () => {
    try {
      const { data, error } = await supabase
        .from('live_locations')
        .select('expires_at')
        .eq('user_id', user?.id)
        .eq('bubble_id', bubbleId)
        .maybeSingle();

      if (data && new Date(data.expires_at) > new Date()) {
        setIsSharing(true);
        setShareExpiry(new Date(data.expires_at));
      }
    } catch (error) {
      console.error('Error checking existing share:', error);
    }
  };

  const fetchLiveLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('live_locations')
        .select(`
          user_id,
          latitude,
          longitude,
          updated_at,
          expires_at,
          profile:profiles(first_name, profile_photo_url)
        `)
        .eq('bubble_id', bubbleId)
        .gt('expires_at', new Date().toISOString());

      if (error) throw error;

      setLiveLocations(data || []);
    } catch (error) {
      console.error('Error fetching live locations:', error);
    }
  };

  const startLocationSharing = async (durationMinutes: number) => {
    if (!navigator.geolocation) {
      toast({
        title: 'Location not supported',
        description: 'Your device does not support location sharing.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Get current location
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

        const { error } = await supabase
          .from('live_locations')
          .upsert({
            user_id: user?.id,
            bubble_id: bubbleId,
            latitude,
            longitude,
            expires_at: expiresAt.toISOString(),
          });

        if (error) throw error;

        setIsSharing(true);
        setShareExpiry(expiresAt);

        toast({
          title: 'Location sharing started',
          description: `Your location will be shared for ${durationMinutes} minutes.`,
        });

        // Set up interval to update location every 30 seconds
        const interval = setInterval(async () => {
          if (new Date() > expiresAt) {
            clearInterval(interval);
            stopLocationSharing();
            return;
          }

          navigator.geolocation.getCurrentPosition(async (pos) => {
            await supabase
              .from('live_locations')
              .update({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', user?.id)
              .eq('bubble_id', bubbleId);
          });
        }, 30000);

      }, (error) => {
        toast({
          title: 'Location access denied',
          description: 'Please enable location access to share your location.',
          variant: 'destructive',
        });
      });

    } catch (error) {
      console.error('Error starting location sharing:', error);
      toast({
        title: 'Error',
        description: 'Failed to start location sharing.',
        variant: 'destructive',
      });
    }
  };

  const stopLocationSharing = async () => {
    try {
      const { error } = await supabase
        .from('live_locations')
        .delete()
        .eq('user_id', user?.id)
        .eq('bubble_id', bubbleId);

      if (error) throw error;

      setIsSharing(false);
      setShareExpiry(null);

      toast({
        title: 'Location sharing stopped',
        description: 'Your location is no longer being shared.',
      });
    } catch (error) {
      console.error('Error stopping location sharing:', error);
    }
  };

  const getTimeRemaining = () => {
    if (!shareExpiry) return '';
    
    const now = new Date();
    const remaining = shareExpiry.getTime() - now.getTime();
    
    if (remaining <= 0) {
      setIsSharing(false);
      setShareExpiry(null);
      return '';
    }
    
    const minutes = Math.floor(remaining / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Live Location Sharing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Share your location</p>
              <p className="text-sm text-muted-foreground">
                Let bubble members see your real-time location
              </p>
            </div>
            <Switch
              checked={isSharing}
              onCheckedChange={(checked) => {
                if (checked) {
                  startLocationSharing(15); // Default 15 minutes
                } else {
                  stopLocationSharing();
                }
              }}
            />
          </div>

          {isSharing && shareExpiry && (
            <div className="bg-primary/10 rounded-lg p-3">
              <div className="flex items-center gap-2 text-primary">
                <Clock className="h-4 w-4" />
                <span className="font-medium">
                  Location sharing active • {getTimeRemaining()} remaining
                </span>
              </div>
            </div>
          )}

          {!isSharing && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[5, 15, 30, 60].map((minutes) => (
                <Button
                  key={minutes}
                  variant="outline"
                  size="sm"
                  onClick={() => startLocationSharing(minutes)}
                >
                  {minutes}min
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Locations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Active Locations ({liveLocations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {liveLocations.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No one is currently sharing their location
            </p>
          ) : (
            <div className="space-y-3">
              {liveLocations.map((location) => (
                <div key={location.user_id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <NavigationIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{location.profile?.first_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Updated {new Date(location.updated_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Live
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Location Map */}
      {liveLocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Live Location Map</CardTitle>
          </CardHeader>
          <CardContent>
            <Map
              bubbles={liveLocations.map(loc => ({
                id: loc.user_id,
                name: loc.profile?.first_name || 'User',
                latitude: loc.latitude,
                longitude: loc.longitude,
                interest_tag: 'Live Location',
                member_count: 1
              }))}
              showBubbles={true}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};