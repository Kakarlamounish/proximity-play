import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Search, MapPin, Users, TrendingUp } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BubbleFilters } from '@/components/BubbleFilters';
import { Navigation } from '@/components/Navigation';
import type { Database } from '@/integrations/supabase/types';
import { CardSkeleton, BubbleSkeleton } from '@/components/ui/skeleton-loader';

interface NearbyUser {
  id: string;
  first_name: string;
  profile_photo_url?: string;
  bio?: string;
  interests?: string[];
  latitude?: number;
  longitude?: number;
  distance?: number;
  mutual_bubbles?: number;
}

interface Bubble {
  id: string;
  name: string;
  description?: string;
  interest_tag: string;
  member_count: number;
  latitude: number;
  longitude: number;
  created_at: string;
  is_private: boolean;
  distance?: number;
}

export default function Discover() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState([5]);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedInterest, setSelectedInterest] = useState('all');
  const [sortBy, setSortBy] = useState('nearest');
  const [profile, setProfile] = useState<Database['public']['Tables']['profiles']['Row'] | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }
      setProfile(data);
    };

    const fetchMyLocation = async () => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('latitude, longitude')
        .eq('id', user?.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching location:', error);
        return;
      }

      if (profile?.latitude && profile?.longitude) {
        setMyLocation({ lat: profile.latitude, lng: profile.longitude });
      }
    };

    fetchProfile();
    fetchMyLocation();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    setProfile(data);
  };

  useEffect(() => {
    if (myLocation) {
      fetchNearbyUsers();
      fetchNearbyBubbles();
    }
  }, [myLocation, radiusKm, selectedInterest, sortBy]);

  const fetchMyLocation = async () => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('latitude, longitude')
      .eq('id', user?.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching location:', error);
      return;
    }

    if (profile?.latitude && profile?.longitude) {
      setMyLocation({ lat: profile.latitude, lng: profile.longitude });
    }
  };

  const fetchNearbyUsers = async () => {
    if (!myLocation || !user) return;

    setLoading(true);
    try {
      // Fetch all profiles with location data
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, first_name, profile_photo_url, bio, interests, latitude, longitude')
        .neq('id', user.id)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (error) throw error;

      // Calculate distances and filter by radius
      const usersWithDistance = profiles
        ?.map(profile => {
          const distance = calculateDistance(
            myLocation.lat,
            myLocation.lng,
            profile.latitude!,
            profile.longitude!
          );
          return { ...profile, distance };
        })
        .filter(user => user.distance <= radiusKm[0])
        .sort((a, b) => a.distance - b.distance) || [];

      setNearbyUsers(usersWithDistance);
    } catch (error) {
      console.error('Error fetching nearby users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load nearby users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const sendFriendRequest = async (receiverId: string) => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user?.id,
          receiver_id: receiverId,
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Already sent',
            description: 'You already sent a friend request to this user',
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: 'Success',
        description: 'Friend request sent!',
      });

      fetchNearbyUsers();
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast({
        title: 'Error',
        description: 'Failed to send friend request',
        variant: 'destructive',
      });
    }
  };

  const fetchNearbyBubbles = async () => {
    if (!myLocation || !user) return;

    try {
      let query = supabase
        .from('bubbles')
        .select('*')
        .eq('is_private', false);

      if (selectedInterest !== 'all') {
        query = query.eq('interest_tag', selectedInterest);
      }

      const { data: bubblesData, error } = await query;

      if (error) throw error;

      const bubblesWithDistance = bubblesData
        ?.map(bubble => {
          const distance = calculateDistance(
            myLocation.lat,
            myLocation.lng,
            Number(bubble.latitude),
            Number(bubble.longitude)
          );
          return { ...bubble, distance };
        })
        .filter(bubble => bubble.distance <= radiusKm[0]) || [];

      // Sort bubbles
      const sortedBubbles = [...bubblesWithDistance];
      switch (sortBy) {
        case 'popular':
          sortedBubbles.sort((a, b) => b.member_count - a.member_count);
          break;
        case 'newest':
          sortedBubbles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          break;
        case 'members':
          sortedBubbles.sort((a, b) => b.member_count - a.member_count);
          break;
        default: // nearest
          sortedBubbles.sort((a, b) => a.distance! - b.distance!);
      }

      setBubbles(sortedBubbles);
    } catch (error) {
      console.error('Error fetching bubbles:', error);
    }
  };

  const joinBubble = async (bubbleId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('bubble_memberships')
        .insert({
          bubble_id: bubbleId,
          user_id: user.id,
          role: 'member'
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Already a member',
            description: 'You are already a member of this bubble',
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: 'Success',
        description: 'Joined bubble successfully!',
      });

      fetchNearbyBubbles();
    } catch (error) {
      console.error('Error joining bubble:', error);
      toast({
        title: 'Error',
        description: 'Failed to join bubble',
        variant: 'destructive',
      });
    }
  };

  const filteredUsers = nearbyUsers.filter(u =>
    u.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.interests?.some(i => i.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredBubbles = bubbles.filter(b =>
    b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!myLocation) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <div className="container mx-auto p-6 max-w-6xl">
        <Card className="p-8 text-center">
          <MapPin className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Location Required</h2>
          <p className="text-muted-foreground">
            Please update your location in your profile to discover nearby users
          </p>
        </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent">
          Discover
        </h1>
        <p className="text-muted-foreground">Find people and bubbles nearby</p>
      </div>

      <Tabs defaultValue="people" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="bubbles">Bubbles</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="space-y-6">

      {/* Filters */}
      <Card className="p-6 mb-6">
        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or interests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Radius: {radiusKm[0]} km
            </label>
            <Slider
              value={radiusKm}
              onValueChange={setRadiusKm}
              max={50}
              min={1}
              step={1}
              className="w-full"
            />
          </div>
        </div>
      </Card>

          {/* Results */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : filteredUsers.length === 0 ? (
            <Card className="p-8 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">No users found</h2>
              <p className="text-muted-foreground">
                Try adjusting your search radius or check back later
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUsers.map((nearbyUser) => (
                <Card key={nearbyUser.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex flex-col items-center text-center">
                    <Avatar className="w-20 h-20 mb-4">
                      <AvatarImage src={nearbyUser.profile_photo_url} />
                      <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-primary-foreground text-lg">
                        {nearbyUser.first_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>

                    <h3 className="font-semibold text-lg mb-1">{nearbyUser.first_name}</h3>
                    
                    <div className="flex items-center text-sm text-muted-foreground mb-3">
                      <MapPin className="w-3 h-3 mr-1" />
                      {nearbyUser.distance?.toFixed(1)} km away
                    </div>

                    {nearbyUser.bio && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {nearbyUser.bio}
                      </p>
                    )}

                    {nearbyUser.interests && nearbyUser.interests.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {nearbyUser.interests.slice(0, 3).map((interest, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <Button
                      onClick={() => sendFriendRequest(nearbyUser.id)}
                      className="w-full bg-gradient-to-r from-secondary to-primary"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Friend
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bubbles" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <BubbleFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedInterest={selectedInterest}
                onInterestChange={setSelectedInterest}
                maxDistance={radiusKm[0]}
                onDistanceChange={setRadiusKm}
                sortBy={sortBy}
                onSortChange={setSortBy}
              />
            </div>

            <div className="lg:col-span-3">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <BubbleSkeleton />
                  <BubbleSkeleton />
                  <BubbleSkeleton />
                  <BubbleSkeleton />
                  <BubbleSkeleton />
                  <BubbleSkeleton />
                </div>
              ) : filteredBubbles.length === 0 ? (
                <Card className="p-8 text-center">
                  <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-xl font-semibold mb-2">No bubbles found</h2>
                  <p className="text-muted-foreground">
                    Try adjusting your filters or check back later
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredBubbles.map((bubble) => (
                    <Card key={bubble.id} className="p-6 hover:shadow-lg transition-shadow">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-1">{bubble.name}</h3>
                            <Badge variant="secondary" className="mb-2">
                              {bubble.interest_tag}
                            </Badge>
                          </div>
                          {bubble.member_count > 10 && (
                            <Badge variant="outline" className="gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Popular
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="w-3 h-3 mr-1" />
                          {bubble.distance?.toFixed(1)} km away
                        </div>

                        {bubble.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {bubble.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Users className="w-4 h-4 mr-1" />
                            {bubble.member_count} members
                          </div>
                          <Button
                            onClick={() => joinBubble(bubble.id)}
                            size="sm"
                            className="bg-gradient-to-r from-secondary to-primary"
                          >
                            Join
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
