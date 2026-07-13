import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Send, MoreVertical, Users, Calendar, ImageIcon, Mic } from 'lucide-react';
import { ImageUpload } from '@/components/ImageUpload';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { VoiceMessagePlayer } from '@/components/VoiceMessagePlayer';
import { MeetupsList } from '@/components/MeetupsList';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

import type { Database } from '@/integrations/supabase/types';

type Message = Database['public']['Tables']['messages']['Row'] & {
  sender?: {
    first_name: string | null;
    profile_photo_url: string | null;
  };
};

type Member = {
  user_id: string;
  profiles: {
    first_name: string | null;
    profile_photo_url: string | null;
  } | null;
};

interface ChatWindowProps {
  bubble: {
    id: string;
    name: string;
    interest_tag: string;
    member_count: number;
    latitude?: number;
    longitude?: number;
    geofence_radius?: number;
  };
  onCreateMeetup?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ bubble, onCreateMeetup }) => {
  // Demo: Bubble geofence center and radius (could be dynamic from DB)
  const bubbleCenter = useMemo(() => [bubble.latitude || 0, bubble.longitude || 0], [bubble.latitude, bubble.longitude]);
  const bubbleRadius = bubble.geofence_radius || 200; // meters
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [insideGeofence, setInsideGeofence] = useState(true);

  // Get user location and check geofence
  useEffect(() => {
    if (!navigator.geolocation) {
      console.log('ChatWindow: Geolocation not available');
      setInsideGeofence(true); // Allow chat if geolocation unavailable
      return;
    }
    console.log('ChatWindow: Starting geolocation watch');
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        console.log('ChatWindow: User location update:', { lat, lng });
        setUserLocation([lat, lng]);
        // Haversine formula
        const R = 6371000;
        const dLat = (lat - bubbleCenter[0]) * Math.PI / 180;
        const dLon = (lng - bubbleCenter[1]) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(bubbleCenter[0] * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const dist = R * c;
        const inside = dist <= bubbleRadius;
        console.log('ChatWindow: Distance from bubble center:', dist, 'meters, inside geofence:', inside);
        setInsideGeofence(inside);
      },
      (err) => {
        console.error('ChatWindow: Geolocation error:', err);
        // Allow chat on geolocation errors to not block functionality
        setInsideGeofence(true);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return () => {
      console.log('ChatWindow: Clearing geolocation watch');
      navigator.geolocation.clearWatch(watchId);
    };
  }, [bubbleCenter, bubbleRadius]);
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch messages and members
  useEffect(() => {
    const fetchData = async () => {
      if (!bubble.id) return;

      try {
        // Fetch messages with sender info
        const { data: messagesData } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            sender_id,
            bubble_id,
            recipient_id
          `)
          .eq('bubble_id', bubble.id)
          .order('created_at', { ascending: true })
          .limit(50);

        // Fetch sender profiles separately
        if (messagesData && messagesData.length > 0) {
          const senderIds = [...new Set(messagesData.map(msg => msg.sender_id))];
          const { data: sendersData } = await supabase
            .from('profiles')
            .select('id, first_name, profile_photo_url')
            .in('id', senderIds);

          const sendersMap = new Map(sendersData?.map(sender => [sender.id, sender]) || []);

          setMessages(messagesData.map(msg => ({
            ...msg,
            sender: sendersMap.get(msg.sender_id) || { first_name: 'Unknown', profile_photo_url: null }
          })));
        } else {
          setMessages([]);
        }

        // Fetch bubble members - simplified to avoid relation issues
        const { data: membershipData } = await supabase
          .from('bubble_memberships')
          .select('user_id')
          .eq('bubble_id', bubble.id);

        if (membershipData && membershipData.length > 0) {
          const userIds = membershipData.map(m => m.user_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, first_name, profile_photo_url')
            .in('id', userIds);

          if (profilesData) {
            const membersWithProfiles: Member[] = membershipData
              .map(m => {
                const profile = profilesData.find(p => p.id === m.user_id);
                return profile ? {
                  user_id: m.user_id,
                  profiles: {
                    first_name: profile.first_name,
                    profile_photo_url: profile.profile_photo_url
                  }
                } : null;
              })
              .filter((m): m is Member => m !== null);
            
            setMembers(membersWithProfiles);
          }
        }
      } catch (error) {
        console.error('Error fetching chat data:', error);
      }
    };

    fetchData();
  }, [bubble.id]);

  // Set up real-time subscription
  useEffect(() => {
    if (!bubble.id) return;

    console.log('ChatWindow: Setting up real-time subscription for bubble:', bubble.id);
    const channel = supabase
      .channel(`chat-messages-${bubble.id}-${Date.now()}`) // Make channel unique
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `bubble_id=eq.${bubble.id}`,
        },
        async (payload) => {
          console.log('ChatWindow: Received new message:', payload.new);
          try {
            // Fetch sender info for new message
            const { data: senderData, error: senderError } = await supabase
              .from('profiles')
              .select('first_name, profile_photo_url')
              .eq('id', payload.new.sender_id)
              .maybeSingle();

            if (senderError) {
              console.error('Error fetching sender:', senderError);
              return;
            }

            const newMessage = {
              ...payload.new,
              sender: senderData
            } as Message;

            setMessages(prev => [...prev, newMessage]);
            console.log('ChatWindow: Added new message to state');
          } catch (error) {
            console.error('ChatWindow: Error processing new message:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('ChatWindow: Subscription status:', status);
      });

    return () => {
      console.log('ChatWindow: Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [bubble.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          content: newMessage.trim(),
          sender_id: user.id,
          bubble_id: bubble.id
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: 'Error sending message',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceMessage = async (audioUrl: string, duration: number) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          content: `🎤 Voice message (${duration}s): ${audioUrl}`,
          sender_id: user.id,
          bubble_id: bubble.id
        });

      if (error) throw error;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: 'Error sending voice message',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleImageUpload = async (imageUrl: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          content: `🖼️ Image: ${imageUrl}`,
          sender_id: user.id,
          bubble_id: bubble.id
        });

      if (error) throw error;

      setShowImageUpload(false);
      toast({
        title: 'Image shared!',
        description: 'Your image has been sent to the chat.',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: 'Error sharing image',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const formatMessageTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Geofence Alert */}
      {!insideGeofence && (
        <div className="bg-yellow-100 text-yellow-800 text-center py-2 font-semibold border-b">
          <div className="flex items-center justify-center gap-2">
            <span>📍</span>
            <span>You are outside the bubble zone. Chat is available but location-based features may be limited.</span>
          </div>
        </div>
      )}
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/20">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 bg-gradient-to-br from-secondary to-primary">
            <AvatarFallback className="text-white font-semibold">
              {bubble.interest_tag[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{bubble.name}</h3>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {bubble.interest_tag}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {bubble.member_count} members
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Meetups
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px]">
              <SheetHeader>
                <SheetTitle>Upcoming Meetups</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <MeetupsList bubbleId={bubble.id} />
              </div>
              <div className="mt-4">
                <Button onClick={onCreateMeetup} className="w-full bg-gradient-to-r from-secondary to-primary">
                  <Calendar className="h-4 w-4 mr-2" />
                  Create New Meetup
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            // Check if message is a voice message
            const isVoiceMessage = message.content.startsWith('🎤 Voice message');
            const voiceUrlMatch = isVoiceMessage ? message.content.match(/https:\/\/[^\s]+/) : null;
            const voiceUrl = voiceUrlMatch ? voiceUrlMatch[0] : null;
            const durationMatch = isVoiceMessage ? message.content.match(/\((\d+)s\)/) : null;
            const duration = durationMatch ? parseInt(durationMatch[1]) : 0;

            return (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${
                  message.sender_id === user?.id ? 'flex-row-reverse' : ''
                }`}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={message.sender?.profile_photo_url || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-secondary to-primary text-white text-sm">
                    {message.sender?.first_name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                
                <div
                  className={`max-w-[70%] ${
                    message.sender_id === user?.id ? 'text-right' : ''
                  }`}
                >
                  <div
                    className={`rounded-lg p-3 ${
                      message.sender_id === user?.id
                        ? 'bg-gradient-to-r from-secondary to-primary text-white'
                        : 'bg-muted'
                    }`}
                  >
                    {isVoiceMessage && voiceUrl ? (
                      <VoiceMessagePlayer audioUrl={voiceUrl} duration={duration} />
                    ) : message.content.startsWith('📸 Snap: ') ? (
                      <img
                        src={message.content.replace('📸 Snap: ', '')}
                        alt="Snap"
                        className="rounded-lg max-w-full max-h-64 object-cover"
                      />
                    ) : message.content.startsWith('🖼️ Image: ') ? (
                      <img
                        src={message.content.replace('🖼️ Image: ', '')}
                        alt="Shared image"
                        className="rounded-lg max-w-full max-h-64 object-cover"
                      />
                    ) : (
                      <p className="text-sm">{message.content}</p>
                    )}
                  </div>
                  <div className={`flex items-center gap-2 mt-1 text-xs text-muted-foreground ${
                    message.sender_id === user?.id ? 'justify-end' : ''
                  }`}>
                    {message.sender_id !== user?.id && (
                      <span>{message.sender?.first_name}</span>
                    )}
                    <span>{formatMessageTime(message.created_at || '')}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t">
        <div className="flex gap-2 items-center">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowImageUpload(true)}
            className="flex-shrink-0"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>

          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1"
          />
          
          <VoiceRecorder 
            onVoiceMessage={handleVoiceMessage}
            disabled={loading}
          />

          <Button
            type="submit"
            disabled={loading || !newMessage.trim()}
            className="bg-gradient-to-r from-secondary to-primary flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>

      {/* Image Upload Dialog */}
      {showImageUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Share an Image</h3>
            <ImageUpload
              onImageUploaded={handleImageUpload}
              userName="Chat Image"
              className="w-full"
            />
            <div className="flex gap-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowImageUpload(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};