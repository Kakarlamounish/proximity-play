import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, MoreVertical, Users, Calendar, ImageIcon, Paperclip } from 'lucide-react';
import { ImageUpload } from '@/components/ImageUpload';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  message_type?: 'text' | 'image';
  image_url?: string;
  sender?: {
    first_name: string;
    profile_photo_url?: string;
  };
}

interface ChatWindowProps {
  bubble: {
    id: string;
    name: string;
    interest_tag: string;
    member_count: number;
  };
  onCreateMeetup?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ bubble, onCreateMeetup }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
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

        // Fetch bubble members
        const { data: membersData } = await supabase
          .from('bubble_memberships')
          .select(`
            user_id,
            profiles (
              first_name,
              profile_photo_url
            )
          `)
          .eq('bubble_id', bubble.id);

        setMembers(membersData || []);
      } catch (error) {
        console.error('Error fetching chat data:', error);
      }
    };

    fetchData();
  }, [bubble.id]);

  // Set up real-time subscription
  useEffect(() => {
    if (!bubble.id) return;

    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `bubble_id=eq.${bubble.id}`,
        },
        async (payload) => {
          // Fetch sender info for new message
          const { data: senderData } = await supabase
            .from('profiles')
            .select('first_name, profile_photo_url')
            .eq('id', payload.new.sender_id)
            .single();

          const newMessage = {
            ...payload.new,
            sender: senderData
          } as Message;

          setMessages(prev => [...prev, newMessage]);
        }
      )
      .subscribe();

    return () => {
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
          bubble_id: bubble.id,
          message_type: 'text'
        });

      if (error) throw error;

      setNewMessage('');
    } catch (error: any) {
      toast({
        title: 'Error sending message',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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
          bubble_id: bubble.id,
          message_type: 'image',
          image_url: imageUrl
        });

      if (error) throw error;

      setShowImageUpload(false);
      toast({
        title: 'Image shared!',
        description: 'Your image has been sent to the chat.',
      });
    } catch (error: any) {
      toast({
        title: 'Error sharing image',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const formatMessageTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  return (
    <div className="flex flex-col h-full">
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
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateMeetup}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Create Meetup
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
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${
                message.sender_id === user?.id ? 'flex-row-reverse' : ''
              }`}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={message.sender?.profile_photo_url} />
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
                    {message.message_type === 'image' && message.image_url ? (
                      <div className="max-w-xs">
                        <img 
                          src={message.image_url} 
                          alt="Shared image" 
                          className="rounded-lg w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(message.image_url, '_blank')}
                        />
                        <p className="text-sm mt-2">{message.content}</p>
                      </div>
                    ) : (
                      <p className="text-sm">{message.content}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {message.sender_id !== user?.id && (
                      <span>{message.sender?.first_name}</span>
                    )}
                    <span>{formatMessageTime(message.created_at)}</span>
                  </div>
                </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t">
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
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1"
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