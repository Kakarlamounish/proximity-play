import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface UseRealtimeNotificationsOptions {
  onNewMessage?: (message: any) => void;
  onBubbleJoin?: (membership: any) => void;
  onNewNotification?: (notification: any) => void;
}

export const useRealtimeNotifications = (options: UseRealtimeNotificationsOptions = {}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const channelsRef = useRef<any[]>([]);

  useEffect(() => {
    if (!user) return;

    // Clean up existing channels
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel);
    });
    channelsRef.current = [];

    // Subscribe to notifications for the current user
    const notificationsChannel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('New notification:', payload);
          const notification = payload.new as any;
          
          // Show toast notification
          toast({
            title: notification.title,
            description: notification.body,
          });

          // Show browser notification if permission granted
          if (Notification.permission === 'granted') {
            new Notification(notification.title, {
              body: notification.body,
              icon: '/logo.png',
              tag: notification.id,
            });
          }

          options.onNewNotification?.(notification);
        }
      )
      .subscribe();

    channelsRef.current.push(notificationsChannel);

    // Subscribe to messages in user's bubbles
    const fetchUserBubbles = async () => {
      const { data: memberships } = await supabase
        .from('bubble_memberships')
        .select('bubble_id')
        .eq('user_id', user.id);

      if (memberships && memberships.length > 0) {
        const bubbleIds = memberships.map(m => m.bubble_id);

        // Subscribe to new messages in user's bubbles
        const messagesChannel = supabase
          .channel('messages-realtime')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
            },
            async (payload) => {
              const message = payload.new as any;
              
              // Only process if message is in user's bubble and not from current user
              if (bubbleIds.includes(message.bubble_id) && message.sender_id !== user.id) {
                console.log('New message in bubble:', message);

                // Fetch sender info
                const { data: sender } = await supabase
                  .from('profiles')
                  .select('first_name')
                  .eq('id', message.sender_id)
                  .single();

                // Fetch bubble info
                const { data: bubble } = await supabase
                  .from('bubbles')
                  .select('name')
                  .eq('id', message.bubble_id)
                  .single();

                toast({
                  title: `New message in ${bubble?.name || 'bubble'}`,
                  description: `${sender?.first_name || 'Someone'}: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`,
                });

                // Browser notification
                if (Notification.permission === 'granted') {
                  new Notification(`New message in ${bubble?.name || 'bubble'}`, {
                    body: `${sender?.first_name || 'Someone'}: ${message.content.substring(0, 100)}`,
                    icon: '/logo.png',
                    tag: `message-${message.id}`,
                  });
                }

                options.onNewMessage?.(message);
              }
            }
          )
          .subscribe();

        channelsRef.current.push(messagesChannel);

        // Subscribe to new members joining user's bubbles (for creators)
        const { data: createdBubbles } = await supabase
          .from('bubbles')
          .select('id')
          .eq('creator_id', user.id);

        if (createdBubbles && createdBubbles.length > 0) {
          const createdBubbleIds = createdBubbles.map(b => b.id);

          const membershipsChannel = supabase
            .channel('memberships-realtime')
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'bubble_memberships',
              },
              async (payload) => {
                const membership = payload.new as any;

                // Only notify if someone joins a bubble the user created
                if (createdBubbleIds.includes(membership.bubble_id) && membership.user_id !== user.id) {
                  console.log('New member joined bubble:', membership);

                  // Fetch new member info
                  const { data: newMember } = await supabase
                    .from('profiles')
                    .select('first_name')
                    .eq('id', membership.user_id)
                    .single();

                  // Fetch bubble info
                  const { data: bubble } = await supabase
                    .from('bubbles')
                    .select('name')
                    .eq('id', membership.bubble_id)
                    .single();

                  toast({
                    title: 'New member joined!',
                    description: `${newMember?.first_name || 'Someone'} joined "${bubble?.name || 'your bubble'}"`,
                  });

                  // Browser notification
                  if (Notification.permission === 'granted') {
                    new Notification('New member joined!', {
                      body: `${newMember?.first_name || 'Someone'} joined "${bubble?.name || 'your bubble'}"`,
                      icon: '/logo.png',
                      tag: `join-${membership.id}`,
                    });
                  }

                  options.onBubbleJoin?.(membership);
                }
              }
            )
            .subscribe();

          channelsRef.current.push(membershipsChannel);
        }
      }
    };

    fetchUserBubbles();

    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
    };
  }, [user, toast, options.onNewMessage, options.onBubbleJoin, options.onNewNotification]);
};
