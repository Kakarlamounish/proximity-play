import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/hooks/useLocation';
import { Navigation } from '@/components/Navigation';
import { BubbleCard } from '@/components/BubbleCard';
import { CreateBubbleDialog } from '@/components/CreateBubbleDialog';
import { ActivityFeed } from '@/components/ActivityFeed';
import { SearchDialog } from '@/components/SearchDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MapPin, Users, Sparkles, RefreshCw, Search } from 'lucide-react';

interface Bubble {
  id: string;
  name: string;
  interest_tag: string;
  member_count: number;
  latitude: number;
  longitude: number;
  distance?: number;
  is_member?: boolean;
}

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { latitude, longitude, loading: locationLoading, error: locationError, requestLocation } = useLocation();
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [bubblesLoading, setBubblesLoading] = useState(false);
  const [radius, setRadius] = useState('2'); // km

  // All hooks must be called before any conditional returns
  useEffect(() => {
    const checkProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching profile:', error);
        }

        setProfile(data);
        
        // If no profile exists, redirect to profile setup
        if (!data) {
          navigate('/profile-setup');
        }
      } catch (error) {
        console.error('Error checking profile:', error);
      } finally {
        setProfileLoading(false);
      }
    };

    if (user && !loading) {
      checkProfile();
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchNearbyBubbles = async () => {
      if (!latitude || !longitude || !user) return;

      setBubblesLoading(true);
      try {
        // For now, let's fetch all bubbles and calculate distance client-side
        const { data: bubblesData, error } = await supabase
          .from('bubbles')
          .select('*')
          .limit(20);

        if (error) {
          console.error('Error fetching bubbles:', error);
          return;
        }

        // Calculate distances
        const bubblesWithDistance = bubblesData?.map((bubble: any) => {
          const distance = calculateDistance(
            latitude,
            longitude,
            bubble.latitude,
            bubble.longitude
          );
          return { ...bubble, distance };
        }).filter((bubble: any) => bubble.distance <= parseFloat(radius));

        // Check which bubbles the user is already a member of
        const bubbleIds = bubblesWithDistance?.map((b: any) => b.id) || [];
        if (bubbleIds.length > 0) {
          const { data: memberships } = await supabase
            .from('bubble_memberships')
            .select('bubble_id')
            .eq('user_id', user.id)
            .in('bubble_id', bubbleIds);

          const membershipIds = new Set(memberships?.map(m => m.bubble_id));

          const bubblesWithMembership = bubblesWithDistance?.map((bubble: any) => ({
            ...bubble,
            is_member: membershipIds.has(bubble.id)
          }));

          setBubbles(bubblesWithMembership || []);
        } else {
          setBubbles([]);
        }
      } catch (error) {
        console.error('Error fetching nearby bubbles:', error);
      } finally {
        setBubblesLoading(false);
      }
    };

    fetchNearbyBubbles();
  }, [latitude, longitude, radius, user]);

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Now safe to do conditional rendering after all hooks
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

  const handleChatClick = (bubbleId: string) => {
    navigate('/messages', { state: { selectedBubbleId: bubbleId } });
  };

  const refreshBubbles = () => {
    requestLocation();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-primary">
      <Navigation profile={profile} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Welcome Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">
              Welcome{profile?.first_name ? `, ${profile.first_name}` : ''}! 
              <Sparkles className="inline-block ml-2 h-8 w-8 text-primary" />
            </h1>
            <p className="text-lg text-muted-foreground">
              Discover social bubbles near you and connect with like-minded people
            </p>
            
            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
              <SearchDialog />
              <CreateBubbleDialog onBubbleCreated={refreshBubbles} />
            </div>
          </div>

          {/* Location Status */}
          <Card className="backdrop-blur-sm bg-card/95 border-0 mb-8">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Location Status</p>
                    {locationLoading ? (
                      <p className="text-sm text-muted-foreground">Getting your location...</p>
                    ) : locationError ? (
                      <p className="text-sm text-destructive">{locationError}</p>
                    ) : latitude && longitude ? (
                      <p className="text-sm text-muted-foreground">
                        Location found • Showing bubbles within {radius}km
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Location not available</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Select value={radius} onValueChange={setRadius}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.5">500m</SelectItem>
                      <SelectItem value="1">1km</SelectItem>
                      <SelectItem value="2">2km</SelectItem>
                      <SelectItem value="5">5km</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshBubbles}
                    disabled={locationLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${locationLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Stats */}
          {profile && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="backdrop-blur-sm bg-card/95 border-0">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{bubbles.filter(b => b.is_member).length}</div>
                  <p className="text-sm text-muted-foreground">Joined Bubbles</p>
                </CardContent>
              </Card>
              <Card className="backdrop-blur-sm bg-card/95 border-0">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{profile.interests?.length || 0}</div>
                  <p className="text-sm text-muted-foreground">Interests</p>
                </CardContent>
              </Card>
              <Card className="backdrop-blur-sm bg-card/95 border-0">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{bubbles.length}</div>
                  <p className="text-sm text-muted-foreground">Nearby Bubbles</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Your Interests */}
          {profile?.interests && profile.interests.length > 0 && (
            <Card className="backdrop-blur-sm bg-card/95 border-0 mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Your Interests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((interest: string, index: number) => (
                    <Badge key={index} variant="secondary">
                      {interest}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activity Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-2">
              <ActivityFeed limit={8} />
            </div>
            <div>
              <Card className="backdrop-blur-sm bg-card/95 border-0">
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Active Bubbles</span>
                      <span className="font-medium">{bubbles.filter(b => b.is_member).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Nearby Options</span>
                      <span className="font-medium">{bubbles.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Your Interests</span>
                      <span className="font-medium">{profile?.interests?.length || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Nearby Bubbles */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-6">Nearby Bubbles</h2>
            
            {bubblesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : bubbles.length === 0 ? (
              <Card className="backdrop-blur-sm bg-card/95 border-0">
                <CardContent className="p-12 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No bubbles found nearby</h3>
                  <p className="text-muted-foreground mb-4">
                    {locationError 
                      ? 'Enable location access to discover bubbles near you'
                      : 'Try expanding your search radius or check back later'
                    }
                  </p>
                  {locationError && (
                    <Button onClick={requestLocation} className="bg-gradient-to-r from-secondary to-primary">
                      Enable Location
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bubbles.map((bubble) => (
                  <BubbleCard
                    key={bubble.id}
                    bubble={bubble}
                    onChat={handleChatClick}
                    onJoin={(bubbleId) => {
                      // Refresh bubbles to update membership status
                      setBubbles(prev => 
                        prev.map(b => 
                          b.id === bubbleId 
                            ? { ...b, is_member: true, member_count: b.member_count + 1 }
                            : b
                        )
                      );
                    }}
                    onLeave={(bubbleId) => {
                      // Refresh bubbles to update membership status
                      setBubbles(prev => 
                        prev.map(b => 
                          b.id === bubbleId 
                            ? { ...b, is_member: false, member_count: Math.max(0, b.member_count - 1) }
                            : b
                        )
                      );
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;