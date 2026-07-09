import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { ChatWindow } from '@/components/ChatWindow';
import {FriendChatWindow} from '@/components/FriendChatWindow';
import { MeetupDialog } from '@/components/MeetupDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { MessageCircle, Users, User, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Loader2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface MessagesProps {
  isOverlay?: boolean;
  initialFriendId?: string;
}

type FriendWithLastMessage = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'first_name' | 'profile_photo_url' | 'bio'> & {
  last_message_at?: string;
  last_message_content?: string;
};

const Messages = ({ isOverlay = false }: MessagesProps = {}) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<Database['public']['Tables']['profiles']['Row'] | null>(null);
  const [bubbles, setBubbles] = useState<Database['public']['Tables']['bubbles']['Row'][]>([]);
  const [friends, setFriends] = useState<FriendWithLastMessage[]>([]);
  const [selectedBubble, setSelectedBubble] = useState<Database['public']['Tables']['bubbles']['Row'] | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<FriendWithLastMessage | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [meetupDialogOpen, setMeetupDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'bubbles' | 'friends'>('bubbles');

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch profile
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

      // Fetch user's bubbles
      const { data: userBubbles } = await supabase
        .from('bubble_memberships')
        .select(`
          bubble_id,
          bubbles (
            id,
            name,
            interest_tag,
            member_count
          )
        `)
        .eq('user_id', user.id);

        // Map bubbles to expected type
        const bubblesData = (userBubbles || []).map(bm => ({
          id: bm.bubbles?.id ?? '',
          name: bm.bubbles?.name ?? '',
          interest_tag: bm.bubbles?.interest_tag ?? '',
          member_count: bm.bubbles?.member_count ?? 0,
          // Fill missing fields with defaults
          created_at: '',
          creator_id: '',
          description: '',
          is_private: false,
          latitude: 0,
          longitude: 0,
          updated_at: '',
        }));
        setBubbles(bubblesData);

        // Fetch user's friends
        const { data: friendships } = await supabase
          .from('friendships')
          .select('user_id_1, user_id_2')
          .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

        const friendIds = friendships?.map(f =>
          f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1
        ) || [];

        if (friendIds.length > 0) {
          const { data: friendsData } = await supabase
            .from('profiles')
            .select('id, first_name, profile_photo_url, bio')
            .in('id', friendIds);

          const { data: recentMessages } = await supabase
            .from('messages')
            .select('sender_id, recipient_id, content, created_at')
            .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
            .order('created_at', { ascending: false });

          const mappedFriends = (friendsData || []).map(friend => {
            const messages = recentMessages?.filter(m => (m.sender_id === friend.id || m.recipient_id === friend.id)) || [];
            const lastMsg = messages[0];
            return {
              ...friend,
              last_message_at: lastMsg?.created_at,
              last_message_content: lastMsg?.content,
            };
          }).sort((a, b) => {
            if (!a.last_message_at) return 1;
            if (!b.last_message_at) return -1;
            return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
          });

          setFriends(mappedFriends);
        }

        // Auto-select first bubble if none selected
        if (bubblesData.length > 0 && !selectedBubble) {
          setSelectedBubble(bubblesData[0]);
        }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setProfileLoading(false);
    }
  }, [user, selectedBubble]);

  useEffect(() => {
    if (user && !loading) {
      fetchData();
    }
  }, [user, loading, fetchData]);

  useEffect(() => {
    const selectedFriendIdFromState = location.state?.selectedFriendId;
    if (friends.length > 0 && selectedFriendIdFromState) {
      const friend = friends.find(f => f.id === selectedFriendIdFromState);
      if (friend && friend.id !== selectedFriend?.id) {
        setSelectedFriend(friend);
        setSelectedBubble(null);
        setActiveTab('friends');
        // Clear state so it doesn't re-trigger
        window.history.replaceState({}, document.title)
      }
    }
  }, [friends, location.state?.selectedFriendId]);

  if (!user && !loading) return <Navigate to="/auth" replace />;

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-background ${!isOverlay ? 'min-h-[calc(100vh-4rem)] pt-20 pb-20 md:pb-0' : 'h-full'}`}>
      {!isOverlay && <Navigation />}
      <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full px-0 sm:px-4 lg:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Messages</h1>
            <p className="text-muted-foreground">Chat with your bubble communities</p>
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'bubbles' | 'friends')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="bubbles" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Bubbles
              </TabsTrigger>
              <TabsTrigger value="friends" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Friends
              </TabsTrigger>
            </TabsList>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chat List */}
              <div className="lg:col-span-1">
                <TabsContent value="bubbles" className="mt-0">
                  <Card className="glass border-0">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        Your Bubbles
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {bubbles.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            Join some bubbles to start chatting!
                          </p>
                        ) : (
                          bubbles.map((bubble) => (
                            <div
                              key={bubble.id}
                              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                                selectedBubble?.id === bubble.id
                                  ? 'bg-primary/10 border border-primary/20'
                                  : 'hover:bg-muted/50'
                              }`}
                              onClick={() => {
                                setSelectedBubble(bubble);
                                setSelectedFriend(null);
                              }}
                            >
                              <Avatar className="h-10 w-10 bg-gradient-to-br from-secondary to-primary">
                                <AvatarFallback className="text-primary-foreground font-semibold">
                                  {(bubble.interest_tag?.[0] ?? 'B').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{bubble.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="secondary" className="text-xs">
                                    {bubble.interest_tag}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {bubble.member_count}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="friends" className="mt-0">
                  <Card className="glass border-0">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Your Friends
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {friends.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            Add friends to start private messaging!
                          </p>
                        ) : (
                          friends.map((friend) => (
                            <div
                              key={friend.id}
                              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                                selectedFriend?.id === friend.id
                                  ? 'bg-primary/10 border border-primary/20'
                                  : 'hover:bg-muted/50'
                              }`}
                              onClick={() => {
                                setSelectedFriend(friend);
                                setSelectedBubble(null);
                              }}
                            >
                              <div className="relative">
                                <Avatar className="h-10 w-10 shrink-0">
                                  <AvatarImage src={friend.profile_photo_url || undefined} className="object-cover" />
                                  <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-primary-foreground">
                                    {friend.first_name?.[0] || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                {/* Online presence dot */}
                                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background bg-green-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                  <p className="font-medium truncate">{friend.first_name}</p>
                                  {friend.last_message_at && (
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                      {formatDistanceToNow(new Date(friend.last_message_at), { addSuffix: true })}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {friend.last_message_content 
                                    ? (friend.last_message_content.startsWith('🎵 Voice Message:') ? '🎤 Voice Message' : friend.last_message_content)
                                    : friend.bio || 'No messages yet'}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>

              {/* Chat Area */}
              <div className="lg:col-span-2">
                <Card className="glass border-0 h-[600px]">
                  {selectedBubble ? (
                    <ChatWindow
                      bubble={selectedBubble}
                      onCreateMeetup={() => setMeetupDialogOpen(true)}
                    />
                  ) : selectedFriend ? (
                    <FriendChatWindow
                      friend={selectedFriend}
                      onStartCall={() => {
                        // Navigate to calls page with selected friend
                        navigate('/calls', { state: { selectedFriendId: selectedFriend.id } });
                      }}
                    />
                  ) : (
                    <CardContent className="p-0 h-full flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">
                          {activeTab === 'bubbles' ? 'Select a bubble to start chatting' : 'Select a friend to message'}
                        </p>
                        <p className="text-sm">
                          {activeTab === 'bubbles'
                            ? 'Connect with your community members in real-time'
                            : 'Start a private conversation with your friends'
                          }
                        </p>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>
            </div>
          </Tabs>

          {/* Meetup Dialog */}
          {selectedBubble && (
            <MeetupDialog
              open={meetupDialogOpen}
              onOpenChange={setMeetupDialogOpen}
              bubbleId={selectedBubble.id}
              bubbleName={selectedBubble.name}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;