import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, MoreVertical, Phone, Video, ImageIcon, Type, Ghost, Eye, EyeOff, Flame, Check, CheckCheck, Mic } from 'lucide-react';
import { ImageUpload } from '@/components/ImageUpload';
import { VoiceNoteRecorder } from '@/components/voice-notes/VoiceNoteRecorder';
import { VoiceMessagePlayer } from '@/components/VoiceMessagePlayer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { useSnapStreaks } from '@/hooks/useSnapStreaks';
import { useSnapScore } from '@/hooks/useSnapScore';
import { Switch } from '@/components/ui/switch';
import { SnapStreakBadge } from '@/components/SnapStreakBadge';
import { hapticPatterns } from '@/hooks/useHapticFeedback';

type Message = {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  recipient_id: string;
  is_disappearing?: boolean | null;
  sender?: {
    first_name: string | null;
    profile_photo_url: string | null;
  };
};

// BUG-011: "Disappearing" was written to the row and never acted on. Chose a
// fixed timer (content hidden 10s after send, for both sender and recipient)
// over view-once/read-then-delete — it's symmetric and needs no cross-device
// read-receipt state to implement correctly.
const DISAPPEAR_TTL_MS = 10_000;

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
  const [messageType, setMessageType] = useState<'text' | 'video' | 'voice'>('text');
  const [isDisappearing, setIsDisappearing] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
            recipient_id,
            is_disappearing
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
            // Haptic feedback for incoming messages
            navigator.vibrate?.(hapticPatterns.messageReceived);
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

  // Typing indicator broadcast channel
  useEffect(() => {
    if (!user || !friend.id) return;
    const roomId = [user.id, friend.id].sort().join('-');
    const channel = supabase.channel(`typing-${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channel.on('broadcast', { event: 'typing' }, (payload) => {
      if (payload.payload?.userId === friend.id) {
        setFriendTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setFriendTyping(false), 3000);
      }
    });
    channel.subscribe();
    typingChannelRef.current = channel;
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [user, friend.id]);

  const sendTyping = () => {
    if (!user || !typingChannelRef.current) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id },
    });
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Re-render periodically so disappearing messages hide once their TTL
  // elapses, without needing a server push for a purely time-based fade.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!messages.some(m => m.is_disappearing)) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [messages]);

  const sendMessageContent = async (content: string, type: 'text' | 'voice' | 'video' = 'text') => {
    if (!user) return;

    // BUG-018: RLS on user_blocks only lets a user read blocks they created,
    // so if this friend blocked the current user (rather than the other way
    // around), a plain client-side check can't see it — the friendship row
    // may even still exist momentarily. Check both directions server-side.
    const { data: blocked } = await supabase.rpc('is_blocked', { user_a: user.id, user_b: friend.id });
    if (blocked) {
      toast({ title: 'Message not sent', description: 'You can no longer message this user.', variant: 'destructive' });
      return;
    }

    // Optimistic update — show message immediately
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMsg: Message = {
      id: optimisticId,
      content,
      created_at: new Date().toISOString(),
      sender_id: user.id,
      recipient_id: friend.id,
      is_disappearing: isDisappearing,
      sender: { first_name: 'You', profile_photo_url: null },
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          content,
          sender_id: user.id,
          recipient_id: friend.id,
          is_disappearing: isDisappearing,
          message_type: type,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Replace optimistic message with real ID so realtime dedup works
      if (data) {
        setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, id: data.id } : m));
      }

      // Notify the recipient via the notifications table (triggers bell badge)
      try {
        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', user.id)
          .maybeSingle();
        await supabase.from('notifications').insert({
          user_id: friend.id,
          type: 'message',
          title: `💬 ${senderProfile?.first_name || 'Someone'} sent you a message`,
          body: type === 'voice' ? '🎵 Voice Message' : content.substring(0, 80) + (content.length > 80 ? '...' : ''),
          read: false,
          data: { sender_id: user.id, message_id: data?.id },
        });
      } catch (_) {}

      // Update streak and snap score
      updateStreak(friend.id);
      incrementScore('snaps_sent');
    } catch (error: unknown) {
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: 'Error sending message',
        description: errorMessage,
        variant: 'destructive',
      });
      // Optionally re-populate input if text message
      if (type === 'text') setNewMessage(content);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (messageType === 'text') {
      if (!newMessage.trim() || !user) return;
      const content = newMessage.trim();
      setNewMessage('');
      await sendMessageContent(content, 'text');
    } else if (messageType === 'video') {
      toast({
        title: 'Video recording',
        description: 'Video message feature is coming soon!',
        variant: 'default',
      });
    }
  };

  const handleImageUpload = async (imageUrl: string) => {
    if (!user) return;

    try {
      const { data: blocked } = await supabase.rpc('is_blocked', { user_a: user.id, user_b: friend.id });
      if (blocked) {
        toast({ title: 'Image not sent', description: 'You can no longer message this user.', variant: 'destructive' });
        return;
      }

      const { error } = await supabase
        .from('messages')
        .insert({
          content: `🖼️ Image: ${imageUrl}`,
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
            const isExpired = !!message.is_disappearing &&
              now - new Date(message.created_at).getTime() > DISAPPEAR_TTL_MS;
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
                  {isExpired ? (
                    <p className="text-sm italic text-muted-foreground/70 flex items-center gap-1.5">
                      <Ghost className="h-3.5 w-3.5" /> This message disappeared
                    </p>
                  ) : message.content.startsWith('🎵 Voice Message: ') ? (
                    <VoiceMessagePlayer audioUrl={message.content.replace('🎵 Voice Message: ', '')} duration={0} />
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
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  )}
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
        {friendTyping && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground italic px-2 pb-1">
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            <span>{friend.first_name || 'Friend'} is typing…</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t">
        {/* Message Type & Disappearing Toggle */}
        <div className="flex items-center gap-2 mb-3">
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
          <Button
            type="button"
            variant={messageType === 'voice' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMessageType(prev => prev === 'voice' ? 'text' : 'voice' as any)}
            className="flex items-center gap-2"
          >
            <Mic className="h-4 w-4" />
            Voice
          </Button>
          <div className="ml-auto flex items-center gap-1.5">
            <Ghost className={`h-4 w-4 ${isDisappearing ? 'text-primary' : 'text-muted-foreground'}`} />
            <Switch
              checked={isDisappearing}
              onCheckedChange={setIsDisappearing}
              className="scale-75"
            />
            <span className="text-[10px] text-muted-foreground">{isDisappearing ? 'Disappearing' : ''}</span>
          </div>
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
              onChange={(e) => { setNewMessage(e.target.value); sendTyping(); }}
              placeholder="Type a message..."
              className="flex-1"
            />
          ) : messageType === 'voice' ? (
            <div className="flex-1">
              <VoiceNoteRecorder
                chatId={`dm-${[user?.id, friend.id].sort().join('-')}`}
                onUploadComplete={(url, duration) => {
                  if (url) {
                    sendMessageContent(`🎵 Voice Message: ${url}`, 'voice');
                    toast({ title: '🎤 Voice note sent!' });
                    setMessageType('text');
                  } else {
                    toast({ title: 'Error sending voice note', variant: 'destructive' });
                  }
                }}
              />
            </div>
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