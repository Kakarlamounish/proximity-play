import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, MessageCircle, Calendar, UserPlus, Heart, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: 'message' | 'meetup' | 'join' | 'like' | 'system';
  title: string;
  content: string;
  created_at: string;
  read: boolean;
  actor_id?: string;
  actor?: {
    first_name: string;
    profile_photo_url?: string;
  };
  metadata?: Record<string, unknown>;
}

export const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    fetchNotifications();
    setupRealtimeSubscription();

    return () => {
      // Cleanup will be handled by useEffect cleanup
    };
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch recent activities that could generate notifications
      const notifications: Notification[] = [];

      // Fetch recent messages in user's bubbles
      const { data: memberships } = await supabase
        .from('bubble_memberships')
        .select('bubble_id')
        .eq('user_id', user.id);

      if (memberships && memberships.length > 0) {
        const bubbleIds = memberships.map(m => m.bubble_id);

        // Get recent messages from user's bubbles
        const { data: recentMessages } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            sender_id,
            bubble_id,
            profiles!messages_sender_id_fkey (
              first_name,
              profile_photo_url
            )
          `)
          .in('bubble_id', bubbleIds)
          .neq('sender_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (recentMessages) {
          recentMessages.forEach(msg => {
            notifications.push({
              id: `msg-${msg.id}`,
              type: 'message',
              title: `${msg.profiles?.first_name || 'Someone'} sent a message`,
              content: msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content,
              created_at: msg.created_at,
              read: false,
              actor_id: msg.sender_id,
              actor: {
                first_name: msg.profiles?.first_name || 'Unknown',
                profile_photo_url: msg.profiles?.profile_photo_url
              }
            });
          });
        }
      }

      // Sort by created_at descending
      notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setNotifications(notifications);
      setUnreadCount(notifications.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user) return;

    // Subscribe to new messages in user's bubbles
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // Check if the message is in one of user's bubbles and not from themselves
          if (payload.new.sender_id !== user.id) {
            fetchNotifications(); // Refresh notifications
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const removeNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    const notification = notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'message':
        return <MessageCircle className="h-4 w-4" />;
      case 'meetup':
        return <Calendar className="h-4 w-4" />;
      case 'join':
        return <UserPlus className="h-4 w-4" />;
      case 'like':
        return <Heart className="h-4 w-4" />;
      case 'system':
        return <Bell className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'message':
        return 'text-blue-500';
      case 'meetup':
        return 'text-green-500';
      case 'join':
        return 'text-purple-500';
      case 'like':
        return 'text-red-500';
      case 'system':
        return 'text-orange-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="text-xs"
            >
              Mark all as read
            </Button>
          )}
        </div>
        
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No notifications yet</p>
              <p className="text-sm">We'll notify you when something happens!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`group flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors ${
                    !notification.read ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                  }`}
                >
                  <div className="flex-shrink-0 mt-1">
                    {notification.actor ? (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={notification.actor.profile_photo_url} />
                        <AvatarFallback className="bg-gradient-to-br from-secondary to-primary text-white text-xs">
                          {notification.actor.first_name[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className={`p-2 rounded-full bg-muted ${getNotificationColor(notification.type)}`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium leading-tight">
                          {notification.title}
                        </p>
                        <p className="text-sm text-muted-foreground leading-tight mt-1">
                          {notification.content}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => removeNotification(notification.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {!notification.read && (
                    <div className="flex-shrink-0 mt-2">
                      <div className="h-2 w-2 bg-primary rounded-full"></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {notifications.length > 0 && (
          <div className="border-t p-2">
            <Button variant="ghost" className="w-full text-sm">
              View all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};