import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, UserMinus, Users, Search, MapPin, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FriendRequests } from '@/components/FriendRequests';
import { Navigation } from '@/components/Navigation';

interface Friend {
  id: string;
  first_name: string;
  profile_photo_url?: string;
  bio?: string;
  interests?: string[];
}

export default function Friends() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [suggestedFriends, setSuggestedFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchRange, setSearchRange] = useState('50'); // km
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    fetchProfile();
    fetchFriends();
    fetchSuggestedFriends();
    getUserLocation();
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

  const fetchFriends = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('friendships')
        .select('user_id_1, user_id_2')
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

      if (error) throw error;

      // Get friend IDs
      const friendIds = data?.map((friendship) => 
        friendship.user_id_1 === user.id ? friendship.user_id_2 : friendship.user_id_1
      ) || [];

      if (friendIds.length > 0) {
        // Fetch friend profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, profile_photo_url, bio, interests')
          .in('id', friendIds);

        setFriends(profiles || []);
      } else {
        setFriends([]);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
      toast({
        title: 'Error',
        description: 'Failed to load friends',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getUserLocation = async () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  const fetchSuggestedFriends = async () => {
    if (!user || !profile) return;

    try {
      // Get users who are in the same bubbles but not friends
      const { data: memberships } = await supabase
        .from('bubble_memberships')
        .select('bubble_id')
        .eq('user_id', user.id);

      if (!memberships || memberships.length === 0) return;

      const bubbleIds = memberships.map(m => m.bubble_id);

      // Get other members of these bubbles
      const { data: otherMembers } = await supabase
        .from('bubble_memberships')
        .select('user_id')
        .in('bubble_id', bubbleIds)
        .neq('user_id', user.id);

      if (!otherMembers || otherMembers.length === 0) return;

      const memberIds = [...new Set(otherMembers.map(m => m.user_id))];

      // Exclude current friends
      const friendIds = friends.map(f => f.id);
      const potentialFriendIds = memberIds.filter(id => !friendIds.includes(id));

      if (potentialFriendIds.length === 0) return;

      // Get profiles of potential friends
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, profile_photo_url, bio, interests')
        .in('id', potentialFriendIds)
        .limit(6);

      setSuggestedFriends(profiles || []);
    } catch (error) {
      console.error('Error fetching suggested friends:', error);
    }
  };

  const sendFriendRequest = async (receiverId: string) => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user!.id,
          receiver_id: receiverId,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: 'Friend request sent!',
        description: 'They will be notified of your request',
      });

      // Remove from suggestions
      setSuggestedFriends(prev => prev.filter(f => f.id !== receiverId));
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast({
        title: 'Error',
        description: 'Failed to send friend request',
        variant: 'destructive',
      });
    }
  };

  const removeFriend = async (friendId: string) => {
    try {
      const userId1 = user!.id < friendId ? user!.id : friendId;
      const userId2 = user!.id < friendId ? friendId : user!.id;

      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id_1', userId1)
        .eq('user_id_2', userId2);

      if (error) throw error;

      toast({
        title: 'Friend removed',
        description: 'Successfully removed friend',
      });

      fetchFriends();
      fetchSuggestedFriends();
    } catch (error) {
      console.error('Error removing friend:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove friend',
        variant: 'destructive',
      });
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      let queryBuilder = supabase
        .from('profiles')
        .select('id, first_name, profile_photo_url, bio, interests, latitude, longitude')
        .neq('id', user!.id)
        .ilike('first_name', `%${query}%`)
        .limit(20);

      // If we have user location and search range, filter by distance
      if (userLocation && searchRange !== 'global') {
        // Note: This is a simplified approach. In production, you'd want to use PostGIS or similar
        // For now, we'll fetch all and filter client-side
        const rangeKm = parseInt(searchRange);
        const { data: allUsers } = await queryBuilder;

        if (allUsers) {
          const filteredUsers = allUsers.filter(user => {
            if (!user.latitude || !user.longitude) return false;

            // Calculate distance using Haversine formula
            const R = 6371; // Earth's radius in km
            const dLat = (user.latitude - userLocation.lat) * Math.PI / 180;
            const dLon = (user.longitude - userLocation.lng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(user.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;

            return distance <= rangeKm;
          });

          setSearchResults(filteredUsers);
        }
      } else {
        const { data } = await queryBuilder;
        setSearchResults(data || []);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      toast({
        title: 'Search failed',
        description: 'Unable to search for users',
        variant: 'destructive',
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    // Debounce search
    const timeoutId = setTimeout(() => {
      searchUsers(value);
    }, 300);
    return () => clearTimeout(timeoutId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-primary">
      <Navigation />
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
            Friends
          </h1>
          <p className="text-muted-foreground">Find and manage your connections</p>
        </div>

        {/* Search Section */}
        <Card className="p-6 mb-8 backdrop-blur-sm bg-card/95 border-0">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search for people by name..."
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <Select value={searchRange} onValueChange={setSearchRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 km</SelectItem>
                  <SelectItem value="5">5 km</SelectItem>
                  <SelectItem value="10">10 km</SelectItem>
                  <SelectItem value="25">25 km</SelectItem>
                  <SelectItem value="50">50 km</SelectItem>
                  <SelectItem value="100">100 km</SelectItem>
                  <SelectItem value="500">500 km</SelectItem>
                  <SelectItem value="1000">1000 km</SelectItem>
                  <SelectItem value="global">Global</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search Results */}
          {searchQuery && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">
                Search Results {searchResults.length > 0 && `(${searchResults.length})`}
              </h3>

              {searchLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : searchResults.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No users found matching "{searchQuery}"
                  {searchRange !== 'global' && ` within ${searchRange}km`}
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {searchResults.map((user) => (
                    <Card key={user.id} className="p-4 hover:shadow-lg transition-shadow">
                      <div className="flex items-start gap-4">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={user.profile_photo_url} />
                          <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-white">
                            {user.first_name?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">{user.first_name}</h4>

                          {user.bio && (
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {user.bio}
                            </p>
                          )}

                          {user.interests && user.interests.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {user.interests.slice(0, 2).map((interest, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {interest}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <Button
                            size="sm"
                            onClick={() => sendFriendRequest(user.id)}
                            className="w-full bg-gradient-to-r from-secondary to-primary"
                          >
                            <UserPlus className="w-3 h-3 mr-1" />
                            Add Friend
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-1">
          <FriendRequests />
        </div>

        <div className="lg:col-span-3 space-y-8">
          {/* Suggested Friends */}
          {suggestedFriends.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                💡 People You May Know
                <Badge variant="secondary" className="text-xs">Suggested</Badge>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {suggestedFriends.map((suggested) => (
                  <Card key={suggested.id} className="p-4 hover:shadow-lg transition-shadow">
                    <div className="flex items-start gap-4">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={suggested.profile_photo_url} />
                        <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-white">
                          {suggested.first_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold mb-1">{suggested.first_name}</h3>

                        {suggested.bio && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {suggested.bio}
                          </p>
                        )}

                        {suggested.interests && suggested.interests.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {suggested.interests.slice(0, 2).map((interest, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {interest}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <Button
                          size="sm"
                          onClick={() => sendFriendRequest(suggested.id)}
                          className="bg-gradient-to-r from-secondary to-primary"
                        >
                          Add Friend
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* My Friends */}
          <div>
            <h2 className="text-2xl font-bold mb-4">My Friends ({friends.length})</h2>

            {loading ? (
              <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : friends.length === 0 ? (
              <Card className="p-8 text-center">
                <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No friends yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start connecting with people nearby
                </p>
                <Button onClick={() => navigate('/discover')}>
                  Discover People
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {friends.map((friend) => (
                  <Card key={friend.id} className="p-4 hover:shadow-lg transition-shadow">
                    <div className="flex items-start gap-4">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={friend.profile_photo_url} />
                        <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-white">
                          {friend.first_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold mb-1">{friend.first_name}</h3>

                        {friend.bio && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {friend.bio}
                          </p>
                        )}

                        {friend.interests && friend.interests.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {friend.interests.slice(0, 2).map((interest, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {interest}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <MessageSquare className="w-3 h-3 mr-1" />
                            Message
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFriend(friend.id)}
                          >
                            <UserMinus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
