import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { getMutualFriendsCount } from '@/utils/mutualFriends';
import { useNotificationSound } from '@/hooks/useNotificationSound';

/**
 * Global component that listens for incoming friend requests in realtime
 * and shows a Facebook-style toast notification with Accept / View actions.
 * Renders nothing — mount once in App.tsx.
 */
export function FriendRequestNotifier() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const seenIds = useRef<Set<string>>(new Set());
  const { playNotificationSound } = useNotificationSound();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('global-friend-request-notifier')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friend_requests',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const req = payload.new as {
            id: string;
            sender_id: string;
            status: string;
          };

          if (seenIds.current.has(req.id)) return;
          seenIds.current.add(req.id);

          // Play notification sound
          playNotificationSound();

          // Fetch sender profile + mutual friends count in parallel
          const [senderResult, mutualCount] = await Promise.all([
            supabase
              .from('profiles')
              .select('first_name, profile_photo_url')
              .eq('id', req.sender_id)
              .maybeSingle(),
            getMutualFriendsCount(user.id, req.sender_id),
          ]);

          const sender = senderResult.data;
          const senderName = sender?.first_name || 'Someone';

          const handleAccept = async () => {
            const { error } = await supabase
              .from('friend_requests')
              .update({ status: 'accepted' })
              .eq('id', req.id);

            if (!error) {
              toast({
                title: '🎉 Friend added!',
                description: `You and ${senderName} are now friends`,
              });
            }
          };

          const mutualText = mutualCount > 0
            ? ` · ${mutualCount} mutual friend${mutualCount > 1 ? 's' : ''}`
            : '';

          toast({
            title: '👋 New Friend Request',
            description: `${senderName} wants to be your friend${mutualText}`,
            duration: 15000,
            action: (
              <div className="flex gap-2 mt-1">
                <button
                  onClick={handleAccept}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Accept
                </button>
                <button
                  onClick={() => navigate('/friends')}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors"
                >
                  View
                </button>
              </div>
            ),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast, navigate, playNotificationSound]);

  return null;
}
