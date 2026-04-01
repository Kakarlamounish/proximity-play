import { useState, useEffect, useCallback, memo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FriendRequest {
  id: string;
  sender_id: string;
  status: string;
  created_at: string;
  sender: {
    first_name: string;
    profile_photo_url?: string;
    interests?: string[];
  };
}

export const FriendRequests = memo(() => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select('id, sender_id, status, created_at')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch sender profiles separately
      if (data && data.length > 0) {
        const senderIds = data.map(r => r.sender_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, profile_photo_url, interests')
          .in('id', senderIds);

        const requestsWithProfiles = data.map(request => ({
          ...request,
          sender: profiles?.find(p => p.id === request.sender_id) || {
            first_name: 'Unknown',
            profile_photo_url: undefined,
            interests: []
          }
        }));

        setRequests(requestsWithProfiles);
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch on mount and subscribe to realtime changes
  useEffect(() => {
    fetchRequests();

    if (!user) return;

    const channel = supabase
      .channel('friend-requests-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRequests, user]);

  const handleRequest = useCallback(async (requestId: string, action: 'accepted' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: action })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: action === 'accepted' ? 'Friend added!' : 'Request declined',
        description: action === 'accepted'
          ? 'You are now friends'
          : 'Friend request declined',
      });

      fetchRequests();
    } catch (error) {
      console.error('Error handling friend request:', error);
      toast({
        title: 'Error',
        description: 'Failed to process request',
        variant: 'destructive',
      });
    }
  }, [fetchRequests, toast]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">No pending friend requests</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-4">Friend Requests</h2>
      {requests.map((request) => (
        <Card key={request.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="w-12 h-12">
                <AvatarImage src={request.sender.profile_photo_url} />
                <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-white">
                  {request.sender.first_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{request.sender.first_name}</h3>
                {request.sender.interests && request.sender.interests.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {request.sender.interests.slice(0, 2).map((interest, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleRequest(request.id, 'accepted')}
                className="bg-gradient-to-r from-secondary to-primary"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRequest(request.id, 'rejected')}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
});

FriendRequests.displayName = 'FriendRequests';
