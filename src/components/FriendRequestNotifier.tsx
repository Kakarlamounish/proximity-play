import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

/**
 * Global component that listens for incoming friend requests in realtime
 * and shows a Facebook-style toast notification with Accept / View actions.
 * Renders nothing — mount once in App.tsx.
 */
export function FriendRequestNotifier() {
  const { user } = useAuth();
  const { toast } = useToast();
  // useNavigate must be called inside <BrowserRouter>, so this component
  // must be rendered inside the router.
  const navigate = useNavigate();
  const seenIds = useRef<Set<string>>(new Set());

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

          // Deduplicate in case of reconnects
          if (seenIds.current.has(req.id)) return;
          seenIds.current.add(req.id);

          // Fetch sender profile for the toast
          const { data: sender } = await supabase
            .from('profiles')
            .select('first_name, profile_photo_url')
            .eq('id', req.sender_id)
            .maybeSingle();

          const senderName = sender?.first_name || 'Someone';

          // Accept helper
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

          // Show the notification toast
          toast({
            title: '👋 New Friend Request',
            description: `${senderName} wants to be your friend`,
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
  }, [user, toast, navigate]);

  return null;
}
