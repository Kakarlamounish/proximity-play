import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, MoreVertical, Phone, Video, ImageIcon, Type, Ghost, Eye, EyeOff, Flame, Check, CheckCheck } from 'lucide-react';
import { ImageUpload } from '@/components/ImageUpload';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { useSnapStreaks } from '@/hooks/useSnapStreaks';
import { useSnapScore } from '@/hooks/useSnapScore';
import { Switch } from '@/components/ui/switch';
import { SnapStreakBadge } from '@/components/SnapStreakBadge';

type Message = {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  recipient_id: string;
  sender?: {
    first_name: string | null;
    profile_photo_url: string | null;
  };
};

interface FriendChatWindowProps {
  friend: {
    id: string;
    first_name: string | null;
    profile_photo_url: string | null;
    bio?: string | null;
  };
  onStartCall?: () => void;
}

export const FriendChatWindow: React.FC<FriendChatWindowProps> = ({ friend, onStartCall }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { streaks, updateStreak } = useSnapStreaks();
  const { incrementScore } = useSnapScore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [messageType, setMessageType] = useState<'text' | 'video'>('text');
  const [isDisappearing, setIsDisappearing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streak = streaks.find(s => s.friend_id === friend.id);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch messages between current user and friend
  useEffect(() => {
    const fetchMessages = async () => {
      if (!user || !friend.id) return;

      try {
        const { data: messagesData } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            sender_id,
            recipient_id
          `)
          .or(`and(sender_id.eq.${user.id},recipient_id.eq.${friend.id}),and(sender_id.eq.${friend.id},recipient_id.eq.${user.id})`)
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
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();
  }, [user, friend.id]);

  // Set up real-time subscription for friend messages
  useEffect(() => {
    if (!user || !friend.id) return;

    const channel = supabase
      .channel(`friend-messages-${friend.id}-${Date.now()}`) // Make channel unique
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('FriendChatWindow: Received message:', payload.new);
          // Only process messages from this friend
          if (payload.new.sender_id === friend.id) {
            try {
              const { data: senderData } = await supabase
                .from('profiles')
                .select('first_name, profile_photo_url')
                .eq('id', payload.new.sender_id)
                .single();

              const newMessage = {
                ...payload.new,
                sender: senderData
              } as Message;

              // Deduplicate — skip if we already have this message (optimistic or realtime)
              setMessages(prev => {
                if (prev.some(m => m.id === newMessage.id)) return prev;
                return [...prev, newMessage];
              });
            } catch (error) {
              console.error('FriendChatWindow: Error processing friend message:', error);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('FriendChatWindow: Subscription status:', status);
      });

    return () => {
      console.log('FriendChatWindow: Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [user, friend.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (messageType === 'text') {
      if (!newMessage.trim() || !user) return;
    } else if (messageType === 'video') {
      toast({
        title: 'Video recording',
        description: 'Video message feature is coming soon!',
        variant: 'default',
      });
      return;
    }

    const content = messageType === 'text'
      ? newMessage.trim()
      : '🎥 Video message (feature coming soon)';

    // Optimistic update — show message immediately
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMsg: Message = {
      id: optimisticId,
      content,
      created_at: new Date().toISOString(),
      sender_id: user!.id,
      recipient_id: friend.id,
      sender: { first_name: 'You', profile_photo_url: null },
    };
    setMessages(prev => [...prev, optimisticMsg]);
    if (messageType === 'text') setNewMessage('');

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          content,
          sender_id: user!.id,
          recipient_id: friend.id,
          is_disappearing: isDisappearing,
          message_type: 'text',
        })
        .select('id')
        .single();

      if (error) throw error;

      // Replace optimistic message with real ID so realtime dedup works
      if (data) {
        setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, id: data.id } : m));
      }

      // Update streak and snap score
      updateStreak(friend.id);
      incrementScore('snaps_sent');
    } catch (error: unknown) {
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      if (messageType === 'text') setNewMessage(content);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: 'Error sending message',
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
          content: 'Shared an image',
          sender_id: user.id,
          recipient_id: friend.id
        });

      if (error) throw error;

      setShowImageUpload(false);
      toast({
        title: 'Image shared!',
        description: 'Your image has been sent to your friend.',
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
      {/* Friend Chat Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/20">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={friend.profile_photo_url} />
            <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-white">
              {friend.first_name?.[0] || 'F'}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{friend.first_name}</h3>
              {streak && streak.streak_count > 0 && (
                <SnapStreakBadge count={streak.streak_count} isExpiring={streak.is_expiring} />
              )}
            </div>
            <p className="text-xs text-muted-foreground">Friend</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onStartCall}
            className="flex items-center gap-2"
          >
            <Phone className="h-4 w-4" />
            Call
          </Button>
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
            const isMine = message.sender_id === user?.id;
            return (
            <div
              key={message.id}
              className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}
            >
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarImage src={message.sender?.profile_photo_url} />
                <AvatarFallback className={`text-xs font-bold ${
                  isMine
                    ? 'bg-secondary text-secondary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {message.sender?.first_name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>

              <div className={`max-w-[70%] ${isMine ? 'text-right' : ''}`}>
                <div
                  className={`rounded-2xl px-4 py-2.5 ${
                    isMine
                      ? 'bg-secondary text-secondary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.content}</p>
                </div>
                <div className={`flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground ${isMine ? 'justify-end' : ''}`}>
                  <span>{formatMessageTime(message.created_at)}</span>
                  {isMine && (
                    <CheckCheck className="h-3 w-3 text-secondary" />
                  )}
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
        {/* Message Type Selector */}
        <div className="flex gap-2 mb-3">
          <Button
            type="button"
            variant={messageType === 'text' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMessageType('text')}
            className="flex items-center gap-2"
          >
            <Type className="h-4 w-4" />
            Text
          </Button>
          <Button
            type="button"
            variant={messageType === 'video' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMessageType('video')}
            className="flex items-center gap-2"
          >
            <Video className="h-4 w-4" />
            Video
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowImageUpload(true)}
            className="flex-shrink-0"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>

          {messageType === 'text' ? (
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
            />
          ) : (
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-md border-2 border-dashed border-muted-foreground/30">
              <Video className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Tap to record video message</span>
              <span className="text-xs text-muted-foreground/70">(Coming soon)</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={messageType === 'text' && !newMessage.trim()}
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
              userName="Friend Chat Image"
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