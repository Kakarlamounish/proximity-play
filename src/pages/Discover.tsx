import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Search, MapPin, Users } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

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

export default function Discover() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState([5]);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    fetchMyLocation();
  }, []);

  useEffect(() => {
    if (myLocation) {
      fetchNearbyUsers();
    }
  }, [myLocation, radiusKm]);

  const fetchMyLocation = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('latitude, longitude')
      .eq('id', user?.id)
      .single();

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

  const filteredUsers = nearbyUsers.filter(u =>
    u.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.interests?.some(i => i.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!myLocation) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Card className="p-8 text-center">
          <MapPin className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Location Required</h2>
          <p className="text-muted-foreground">
            Please update your location in your profile to discover nearby users
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
          Discover People
        </h1>
        <p className="text-muted-foreground">Find and connect with people nearby</p>
      </div>

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
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
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
                  <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-white text-lg">
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
    </div>
  );
}
