import { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, UserMinus, Users, Search, MapPin, UserPlus, Phone, Video, Flame, Ban } from 'lucide-react';
import { getMutualFriendsCountBatch } from '@/utils/mutualFriends';
import { useNavigate } from 'react-router-dom';
import { FriendRequests } from '@/components/FriendRequests';
import { Navigation } from '@/components/Navigation';
import { useCallContext } from '@/contexts/CallContext';
import { useSnapStreaks } from '@/hooks/useSnapStreaks';
import { SnapStreakBadge } from '@/components/SnapStreakBadge';

interface Friend {
  id: string;
  first_name: string;
  profile_photo_url?: string;
  bio?: string;
  interests?: string[];
  latitude?: number;
  longitude?: number;
  mutualFriendsCount?: number;
}

interface FriendsProps {
  isOverlay?: boolean;
}

export default function Friends({ isOverlay = false }: FriendsProps = {}) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { startCall } = useCallContext();
  const navigate = useNavigate();
  const { streaks } = useSnapStreaks();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [sendingRequestIds, setSendingRequestIds] = useState<string[]>([]);
  // BUG-018: users had no way to block anyone (a `user_blocks` table existed,
  // but Settings' "Blocked Users" list could only unblock — nothing ever
  // created a block).
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [blockingIds, setBlockingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  interface Profile {
    id: string;
    first_name?: string;
    bio?: string;
    interests?: string[];
  }
  const [profile, setProfile] = useState<Profile | null>(null);
  const [suggestedFriends, setSuggestedFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchRange, setSearchRange] = useState('50'); // km
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const fetchBlockedIds = async () => {
    if (!user) return;
    // RLS on user_blocks only lets a user read rows where they're the
    // blocker — this covers "who have I blocked" for filtering my own
    // lists. The reverse ("who has blocked me") is checked separately via
    // the is_blocked RPC at the point of action (send request/message/call).
    const { data } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', user.id);
    setBlockedIds((data || []).map((r) => r.blocked_id));
  };

  const blockUser = async (targetId: string, targetName?: string) => {
    if (!user) return;
    setBlockingIds((prev) => [...prev, targetId]);
    try {
      const { error } = await supabase.from('user_blocks').insert({ blocker_id: user.id, blocked_id: targetId });
      if (error) throw error;

      // Blocking someone severs any existing friendship/pending requests —
      // staying "friends" with someone you just blocked doesn't make sense.
      const userId1 = user.id < targetId ? user.id : targetId;
      const userId2 = user.id < targetId ? targetId : user.id;
      await supabase.from('friendships').delete().eq('user_id_1', userId1).eq('user_id_2', userId2);
      await supabase
        .from('friend_requests')
        .delete()
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${user.id})`);

      setBlockedIds((prev) => [...prev, targetId]);
      setFriends((prev) => prev.filter((f) => f.id !== targetId));
      setSuggestedFriends((prev) => prev.filter((f) => f.id !== targetId));
      setSearchResults((prev) => prev.filter((f) => f.id !== targetId));
      setSentRequests((prev) => prev.filter((id) => id !== targetId));

      toast({ title: 'User blocked', description: `${targetName || 'This user'} can no longer contact you.` });
    } catch (error) {
      console.error('Error blocking user:', error);
      toast({ title: 'Error', description: 'Failed to block user', variant: 'destructive' });
    } finally {
      setBlockingIds((prev) => prev.filter((id) => id !== targetId));
    }
  };

  const fetchSentRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('friend_requests')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('status', 'pending');
    
    if (data) {
      setSentRequests(data.map(r => r.sender_id === user.id ? r.receiver_id : r.sender_id));
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

  const fetchSuggestedFriends = useCallback(async () => {
    if (!user || !profile) return;

    try {
      // Get users who are in the same bubbles but not friends
      const { data: memberships } = await supabase
        .from('bubble_memberships')
        .select('bubble_id')
        .eq('user_id', user.id);

      if (!memberships || memberships.length === 0) {
        setSuggestedFriends([]);
        return;
      }

      const bubbleIds = memberships.map(m => m.bubble_id);

      // Get other members of these bubbles
      const { data: otherMembers } = await supabase
        .from('bubble_memberships')
        .select('user_id')
        .in('bubble_id', bubbleIds)
        .neq('user_id', user.id);

      if (!otherMembers || otherMembers.length === 0) {
        setSuggestedFriends([]);
        return;
      }

      const memberIds = [...new Set(otherMembers.map(m => m.user_id).filter(id => id !== null && typeof id === 'string'))] as string[];

      // Exclude current friends
      const friendIds = friends?.map(f => f.id) || [];
      const potentialFriendIds = memberIds.filter(id => !friendIds.includes(id));

      if (potentialFriendIds.length === 0) {
        setSuggestedFriends([]);
        return;
      }

      // Get profiles of potential friends
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, profile_photo_url, bio, interests')
        .in('id', potentialFriendIds)
        .limit(6);

      if (profiles && profiles.length > 0) {
        const mutualCounts = await getMutualFriendsCountBatch(user.id, profiles.map(p => p.id));
        setSuggestedFriends(profiles.map(p => ({
          ...p,
          mutualFriendsCount: mutualCounts.get(p.id) || 0,
        })));
      } else {
        setSuggestedFriends([]);
      }
    } catch (error) {
      console.error('Error fetching suggested friends:', error);
      setSuggestedFriends([]);
    }
  }, [user, profile, friends]);

  const sendFriendRequest = async (receiverId: string) => {
    // BUG-017: fast double-click on "Add Friend" could fire this twice before
    // either request's guard query resolved, creating two pending rows.
    if (sendingRequestIds.includes(receiverId)) return;
    setSendingRequestIds(prev => [...prev, receiverId]);

    try {
      // BUG-018: RLS on user_blocks only lets a user read blocks they
      // created, so a receiver who blocked the current user is invisible to
      // a plain client-side list filter. Check both directions server-side
      // via the is_blocked RPC before sending.
      const { data: blocked } = await supabase.rpc('is_blocked', { user_a: user?.id, user_b: receiverId });
      if (blocked) {
        toast({ title: 'Unable to send request', description: 'This user is not reachable.', variant: 'destructive' });
        return;
      }

      // BUG-017: this previously used `.single()`, which returns null (with
      // no thrown error) once more than one historical row matches — a
      // realistic case after a reject-then-resend cycle — silently
      // bypassing the guard entirely. Fetch all matching rows and check
      // across the whole set instead of assuming exactly one exists.
      const { data: existingRequests } = await supabase
        .from('friend_requests')
        .select('id, status')
        .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user?.id})`);

      if (existingRequests?.some(r => r.status === 'pending')) {
        toast({
          title: 'Request already sent',
          description: 'You have already sent a friend request to this person',
          variant: 'destructive',
        });
        return;
      }
      if (existingRequests?.some(r => r.status === 'accepted')) {
        toast({
          title: 'Already friends',
          description: 'You are already friends with this person',
          variant: 'destructive',
        });
        return;
      }

      // Check if they are already friends
      const { data: existingFriendship } = await supabase
        .from('friendships')
        .select('id')
        .or(`and(user_id_1.eq.${user?.id},user_id_2.eq.${receiverId}),and(user_id_1.eq.${receiverId},user_id_2.eq.${user?.id})`)
        .maybeSingle();

      if (existingFriendship) {
        toast({
          title: 'Already friends',
          description: 'You are already friends with this person',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user?.id,
          receiver_id: receiverId,
          status: 'pending'
        });

      if (error) throw error;

      // Send notification
      await supabase.from('notifications').insert({
        user_id: receiverId,
        type: 'friend_request',
        title: 'New Friend Request',
        body: `${profile?.first_name || 'Someone'} sent you a friend request.`,
        data: { sender_id: user?.id }
      });

      toast({
        title: 'Friend request sent!',
        description: 'They will be notified of your request',
      });

      // Update local state so it persists across searches without reload
      setSentRequests(prev => [...prev, receiverId]);

      // Remove from suggestions and search results
      setSuggestedFriends(prev => prev.filter(f => f.id !== receiverId));
      // Optional: keep in search results but it will be disabled now
      // setSearchResults(prev => prev.filter(f => f.id !== receiverId));
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast({
        title: 'Error',
        description: 'Failed to send friend request',
        variant: 'destructive',
      });
    } finally {
      setSendingRequestIds(prev => prev.filter(id => id !== receiverId));
    }
  };

  const removeFriend = async (friendId: string) => {
    try {
      const userId1 = user?.id && user.id < friendId ? user.id : friendId;
      const userId2 = user?.id && user.id < friendId ? friendId : user.id;

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

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() && searchRange === 'global') {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      let queryBuilder = supabase
        .from('profiles')
        .select('id, first_name, profile_photo_url, bio, interests, latitude, longitude')
        .neq('id', user?.id);

      if (query.trim()) {
        queryBuilder = queryBuilder.ilike('first_name', `%${query}%`).limit(50);
      } else {
        queryBuilder = queryBuilder.limit(100);
      }

      // If we have user location and search range, filter by distance
      if (userLocation && searchRange !== 'global') {
        // Note: This is a simplified approach. In production, you'd want to use PostGIS or similar
        // For now, we'll fetch all and filter client-side
        const rangeKm = parseInt(searchRange);
        const { data: allUsers } = await queryBuilder;

        if (allUsers) {
          const filteredUsers = allUsers.filter(person => {
            if (!person.latitude || !person.longitude) return false;

            // Calculate distance using Haversine formula
            const R = 6371; // Earth's radius in km
            const dLat = (person.latitude - userLocation.lat) * Math.PI / 180;
            const dLon = (person.longitude - userLocation.lng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(person.latitude * Math.PI / 180) *
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
  }, [user, userLocation, searchRange]);

  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    // Debounce search
    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(value);
    }, 300);
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchFriends();
    fetchSentRequests();
    fetchBlockedIds();
    getUserLocation();
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() || (searchRange !== 'global' && userLocation)) {
      searchUsers(searchQuery);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchRange, userLocation, searchUsers]);

  useEffect(() => {
    fetchSuggestedFriends();
  }, [fetchSuggestedFriends, user, profile, friends]);

  const visibleSearchResults = (searchResults || []).filter((p) => !blockedIds.includes(p.id));
  const visibleSuggestedFriends = (suggestedFriends || []).filter((p) => !blockedIds.includes(p.id));

  if (!isOverlay && !user && !authLoading) return <Navigate to="/auth?returnTo=/friends" replace />;

  return (
    <div className={`bg-background ${!isOverlay ? 'min-h-[calc(100vh-4rem)] pt-20' : 'h-full overflow-y-auto'}`}>
      {!isOverlay && <Navigation />}
      
      <div className="container max-w-4xl mx-auto px-4 pb-12">
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold mb-2 text-foreground">
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
          {(searchQuery || (searchRange !== 'global' && userLocation)) && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">
                {searchQuery ? 'Search Results' : 'Nearby People'} {visibleSearchResults.length > 0 && `(${visibleSearchResults.length})`}
              </h3>

              {searchLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : visibleSearchResults.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {searchQuery
                    ? `No users found matching "${searchQuery}"`
                    : 'No users found nearby'
                  }
                  {searchRange !== 'global' && ` within ${searchRange}km`}
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleSearchResults.map((person) => (
                    <Card key={person.id} className="p-4 hover:shadow-lg transition-shadow">
                      <div className="flex items-start gap-4">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={person.profile_photo_url || undefined} />
                          <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-primary-foreground">
                            {person.first_name?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">{person.first_name}</h4>

                          {person.bio && (
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {person.bio}
                            </p>
                          )}

                          {person.interests && person.interests.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {person.interests.slice(0, 2).map((interest, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {interest}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => sendFriendRequest(person.id)}
                              className="flex-1 bg-gradient-to-r from-secondary to-primary"
                              disabled={friends?.some(f => f.id === person.id) || sentRequests.includes(person.id) || sendingRequestIds.includes(person.id)}
                            >
                              <UserPlus className="w-3 h-3 mr-1" />
                              {friends?.some(f => f.id === person.id)
                                ? 'Already Friends'
                                : sentRequests.includes(person.id)
                                  ? 'Request Sent'
                                  : 'Add Friend'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                              onClick={() => blockUser(person.id, person.first_name)}
                              disabled={blockingIds.includes(person.id)}
                              title="Block user"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </Button>
                          </div>
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
          <FriendRequests onAccepted={fetchFriends} />
        </div>

        <div className="lg:col-span-3 space-y-8">
          {/* Suggested Friends */}
          {visibleSuggestedFriends.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                💡 People You May Know
                <Badge variant="secondary" className="text-xs">Suggested</Badge>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {visibleSuggestedFriends.map((suggested) => (
                  <Card key={suggested.id} className="p-4 hover:shadow-lg transition-shadow">
                    <div className="flex items-start gap-4">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={suggested.profile_photo_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-primary-foreground">
                          {suggested.first_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold mb-1">{suggested.first_name}</h3>
                        {(suggested.mutualFriendsCount ?? 0) > 0 && (
                          <p className="text-xs text-muted-foreground mb-1">
                            👥 {suggested.mutualFriendsCount} mutual friend{suggested.mutualFriendsCount! > 1 ? 's' : ''}
                          </p>
                        )}
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

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => sendFriendRequest(suggested.id)}
                            className="bg-gradient-to-r from-secondary to-primary"
                            disabled={friends?.some(f => f.id === suggested.id) || sentRequests.includes(suggested.id) || sendingRequestIds.includes(suggested.id)}
                          >
                            {friends?.some(f => f.id === suggested.id)
                              ? 'Already Friends'
                              : sentRequests.includes(suggested.id)
                                ? 'Request Sent'
                                : 'Add Friend'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                            onClick={() => blockUser(suggested.id, suggested.first_name)}
                            disabled={blockingIds.includes(suggested.id)}
                            title="Block user"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* My Friends */}
          <div>
            <h2 className="text-2xl font-bold mb-4">My Friends ({friends?.length || 0})</h2>

            {loading ? (
              <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : (friends?.length || 0) === 0 ? (
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
                {friends?.map((friend) => {
                  const streak = streaks.find(s => s.friend_id === friend.id);
                  return (
                  <Card key={friend.id} className="p-4 hover:shadow-lg transition-shadow">
                    <div className="flex items-start gap-4">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={friend.profile_photo_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-primary-foreground">
                          {friend.first_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{friend.first_name}</h3>
                          {streak && streak.streak_count > 0 && (
                            <SnapStreakBadge count={streak.streak_count} isExpiring={streak.is_expiring} />
                          )}
                        </div>

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
                          <Button 
                            size="sm" 
                            variant="secondary"
                            className="bg-white/10 text-primary-foreground hover:bg-white/20 border-0"
                            onClick={() => navigate('/messages', { state: { selectedFriendId: friend.id } })}
                          >
                            <MessageSquare className="w-4 h-4 mr-1.5" />
                            Message
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="secondary"
                            className="bg-primary text-primary-foreground hover:bg-primary/80 border-0"
                            onClick={() => startCall(friend.id, 'audio', false)}
                          >
                            <Phone className="w-4 h-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant="secondary"
                            className="bg-primary text-primary-foreground hover:bg-primary/80 border-0"
                            onClick={() => startCall(friend.id, 'video', false)}
                          >
                            <Video className="w-4 h-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                            onClick={() => removeFriend(friend.id)}
                            title="Remove friend"
                          >
                            <UserMinus className="w-4 h-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                            onClick={() => blockUser(friend.id, friend.first_name)}
                            disabled={blockingIds.includes(friend.id)}
                            title="Block user"
                          >
                            <Ban className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
