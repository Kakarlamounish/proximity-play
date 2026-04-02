import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';
import { RealtimeChannel, RealtimePostgresInsertPayload } from '@supabase/supabase-js';

type Message = Database['public']['Tables']['messages']['Row'];
type Membership = Database['public']['Tables']['bubble_memberships']['Row'];
type Notification = Database['public']['Tables']['notifications']['Row'];

interface UseRealtimeNotificationsOptions {
  onNewMessage?: (message: Message) => void;
  onBubbleJoin?: (membership: Membership) => void;
  onNewNotification?: (notification: Notification) => void;
}

export const useRealtimeNotifications = (options: UseRealtimeNotificationsOptions = {}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const optionsRef = useRef(options);

  // Keep options ref in sync
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!user) {
      console.log('useRealtimeNotifications: No user, skipping subscription');
      return;
    }

    console.log('useRealtimeNotifications: Initializing subscriptions for user', user.id);

    let isMounted = true;
    const activeChannels: RealtimeChannel[] = [];

    const cleanup = () => {
      console.log('useRealtimeNotifications: Cleaning up subscriptions');
      isMounted = false;
      activeChannels.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = channelsRef.current.filter(c => !activeChannels.includes(c));
    };

    // 1. Subscribe to notifications for the current user
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
          if (!isMounted) return;
          console.log('New notification:', payload);
          const notification = payload.new as Notification;
          
          toast({
            title: notification.title || 'New Notification',
            description: notification.body || '',
          });

          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(notification.title, {
              body: notification.body,
              icon: '/logo.png',
              tag: notification.id,
            });
          }

          optionsRef.current.onNewNotification?.(notification);
        }
      )
      .subscribe((status) => {
        console.log('useRealtimeNotifications: notificationsChannel status', status);
      });

    activeChannels.push(notificationsChannel);
    channelsRef.current.push(notificationsChannel);

    // 2. Subscribe to messages and memberships in user's bubbles
    const setupBubbleSubscriptions = async () => {
      try {
        const { data: memberships } = await supabase
          .from('bubble_memberships')
          .select('bubble_id')
          .eq('user_id', user.id);

        if (!isMounted) return;
        if (!memberships || memberships.length === 0) {
          console.log('useRealtimeNotifications: No bubble memberships found');
          return;
        }

        const bubbleIds = memberships.map(m => m.bubble_id);
        console.log('useRealtimeNotifications: Setting up subscriptions for', bubbleIds.length, 'bubbles');

        // Subscribe to new messages
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
              if (!isMounted) return;
              const message = payload.new as Message;
              
              if (bubbleIds.includes(message.bubble_id) && message.sender_id !== user.id) {
                console.log('New message in bubble:', message);

                const [{ data: sender }, { data: bubble }] = await Promise.all([
                  supabase.from('profiles').select('first_name').eq('id', message.sender_id).single(),
                  supabase.from('bubbles').select('name').eq('id', message.bubble_id).single()
                ]);

                toast({
                  title: `New message in ${bubble?.name || 'bubble'}`,
                  description: `${sender?.first_name || 'Someone'}: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`,
                });

                if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                  new Notification(`New message in ${bubble?.name || 'bubble'}`, {
                    body: `${sender?.first_name || 'Someone'}: ${message.content.substring(0, 100)}`,
                    icon: '/logo.png',
                    tag: `message-${message.id}`,
                  });
                }

                optionsRef.current.onNewMessage?.(message);
              }
            }
          )
          .subscribe((status) => {
            console.log('useRealtimeNotifications: messagesChannel status', status);
          });

        activeChannels.push(messagesChannel);
        channelsRef.current.push(messagesChannel);

        // Subscribe to new members (for creators)
        const { data: createdBubbles } = await supabase
          .from('bubbles')
          .select('id')
          .eq('creator_id', user.id);

        if (isMounted && createdBubbles && createdBubbles.length > 0) {
          const createdBubbleIds = createdBubbles.map(b => b.id);
          console.log('useRealtimeNotifications: Watching memberships for', createdBubbleIds.length, 'created bubbles');

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
                if (!isMounted) return;
                const membership = payload.new as Membership;

                if (createdBubbleIds.includes(membership.bubble_id) && membership.user_id !== user.id) {
                  const [{ data: newMember }, { data: bubble }] = await Promise.all([
                    supabase.from('profiles').select('first_name').eq('id', membership.user_id).single(),
                    supabase.from('bubbles').select('name').eq('id', membership.bubble_id).single()
                  ]);

                  toast({
                    title: 'New member joined!',
                    description: `${newMember?.first_name || 'Someone'} joined "${bubble?.name || 'your bubble'}"`,
                  });

                  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    new Notification('New member joined!', {
                      body: `${newMember?.first_name || 'Someone'} joined "${bubble?.name || 'your bubble'}"`,
                      icon: '/logo.png',
                      tag: `join-${membership.id}`,
                    });
                  }

                  optionsRef.current.onBubbleJoin?.(membership);
                }
              }
            )
            .subscribe((status) => {
              console.log('useRealtimeNotifications: membershipsChannel status', status);
            });

          activeChannels.push(membershipsChannel);
          channelsRef.current.push(membershipsChannel);
        }
      } catch (error) {
        console.error('Error setting up bubble subscriptions:', error);
      }
    };

    setupBubbleSubscriptions();

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return cleanup;
  }, [user, toast]);
};
