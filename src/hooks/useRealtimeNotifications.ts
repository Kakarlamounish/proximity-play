import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import {
  isNotificationCategoryEnabled,
  getNotificationPreferences,
} from '@/utils/notificationPreferences';
import { showSystemNotification } from '@/utils/showSystemNotification';
import { Database } from '@/integrations/supabase/types';
import { RealtimeChannel } from '@supabase/supabase-js';

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
  const { playNotificationSound } = useNotificationSound();
  const optionsRef = useRef(options);
  const toastRef = useRef(toast);
  const playSoundRef = useRef(playNotificationSound);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    playSoundRef.current = playNotificationSound;
  }, [playNotificationSound]);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const activeChannels: RealtimeChannel[] = [];
    const channelId = `rt-${user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const cleanup = () => {
      isMounted = false;
      activeChannels.forEach(ch => supabase.removeChannel(ch));
    };

    // 1. Notifications for the current user
    const notifChannel = supabase
      .channel(`${channelId}-notif`)
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
          const n = payload.new as Notification;

          if (isNotificationCategoryEnabled(n.type)) {
            // Play notification chime + show toast card
            playSoundRef.current();
            toastRef.current({
              title: n.title || 'New Notification',
              description: n.body || '',
            });
            // Fire OS-level push-style notification when the tab isn't
            // focused, so the Settings toggle actually reaches the user
            // outside the app.
            const prefs = getNotificationPreferences();
            if (prefs.push && (typeof document === 'undefined' || document.visibilityState !== 'visible')) {
              showSystemNotification({
                title: n.title || 'New Notification',
                body: n.body || '',
                tag: `notif-${n.id}`,
                data: { type: n.type, id: n.id },
              });
            }
          }

          optionsRef.current.onNewNotification?.(n);
        }
      )
      .subscribe();

    activeChannels.push(notifChannel);

    // 1b. Direct messages addressed to the current user (1:1 chat).
    // Bubble messages are handled separately below; this covers DMs so the
    // "Messages" toggle in Settings actually gates chat alerts.
    const dmChannel = supabase
      .channel(`${channelId}-dm`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          if (!isMounted) return;
          const message = payload.new as Message;
          if (message.sender_id === user.id) return;
          if (!isNotificationCategoryEnabled('message')) return;

          const { data: sender } = await supabase
            .from('profiles')
            .select('first_name')
            .eq('id', message.sender_id)
            .single();

          const name = sender?.first_name || 'Someone';
          const preview = (message.content || '').substring(0, 80);
          const title = `💬 ${name}`;

          playSoundRef.current();
          toastRef.current({ title, description: preview });

          const prefs = getNotificationPreferences();
          if (prefs.push && (typeof document === 'undefined' || document.visibilityState !== 'visible')) {
            showSystemNotification({
              title,
              body: preview,
              tag: `dm-${message.sender_id}`,
              data: { type: 'message', senderId: message.sender_id },
            });
          }

          optionsRef.current.onNewMessage?.(message);
        }
      )
      .subscribe();

    activeChannels.push(dmChannel);

    // 2. Messages & memberships in user's bubbles
    const setupBubbleSubs = async () => {
      try {
        const { data: memberships } = await supabase
          .from('bubble_memberships')
          .select('bubble_id')
          .eq('user_id', user.id);

        if (!isMounted || !memberships?.length) return;

        const bubbleIds = memberships.map(m => m.bubble_id);

        const msgChannel = supabase
          .channel(`${channelId}-msg`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            async (payload) => {
              if (!isMounted) return;
              const message = payload.new as Message;

              if (bubbleIds.includes(message.bubble_id) && message.sender_id !== user.id) {
                if (isNotificationCategoryEnabled('bubble_message')) {
                  const [{ data: sender }, { data: bubble }] = await Promise.all([
                    supabase.from('profiles').select('first_name').eq('id', message.sender_id).single(),
                    supabase.from('bubbles').select('name').eq('id', message.bubble_id).single(),
                  ]);

                  const title = `💬 ${bubble?.name || 'Bubble'}`;
                  const description = `${sender?.first_name || 'Someone'}: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`;

                  // Play notification chime + show toast card
                  playSoundRef.current();
                  toastRef.current({ title, description });

                  const prefs = getNotificationPreferences();
                  if (prefs.push && (typeof document === 'undefined' || document.visibilityState !== 'visible')) {
                    showSystemNotification({
                      title,
                      body: description,
                      tag: `bubble-${message.bubble_id}`,
                      data: { type: 'bubble_message', bubbleId: message.bubble_id },
                    });
                  }
                }

                optionsRef.current.onNewMessage?.(message);
              }
            }
          )
          .subscribe();

        activeChannels.push(msgChannel);

        const { data: createdBubbles } = await supabase
          .from('bubbles')
          .select('id')
          .eq('creator_id', user.id);

        if (isMounted && createdBubbles?.length) {
          const createdIds = createdBubbles.map(b => b.id);

          const memChannel = supabase
            .channel(`${channelId}-mem`)
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'bubble_memberships' },
              async (payload) => {
                if (!isMounted) return;
                const membership = payload.new as Membership;

                if (createdIds.includes(membership.bubble_id) && membership.user_id !== user.id) {
                  if (isNotificationCategoryEnabled('bubble_join')) {
                    const [{ data: newMember }, { data: bubble }] = await Promise.all([
                      supabase.from('profiles').select('first_name').eq('id', membership.user_id).single(),
                      supabase.from('bubbles').select('name').eq('id', membership.bubble_id).single(),
                    ]);

                    toastRef.current({
                      title: 'New member joined!',
                      description: `${newMember?.first_name || 'Someone'} joined "${bubble?.name || 'your bubble'}"`,
                    });
                  }

                  optionsRef.current.onBubbleJoin?.(membership);
                }
              }
            )
            .subscribe();

          activeChannels.push(memChannel);
        }
      } catch (error) {
        console.error('Error setting up bubble subscriptions:', error);
      }
    };

    setupBubbleSubs();

    return cleanup;
  }, [user]);
};
