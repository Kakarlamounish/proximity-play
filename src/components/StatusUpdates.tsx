import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Coffee, 
  Briefcase, 
  Music, 
  GamepadIcon, 
  BookOpen,
  Smile,
  Heart,
  MessageCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Status {
  id: string;
  user_id: string;
  bubble_id: string;
  status_text: string;
  emoji: string;
  activity_type: string;
  expires_at: string;
  created_at: string;
  profile: {
    first_name: string;
    profile_photo_url: string | null;
  };
  reactions: any[];
}

interface StatusUpdatesProps {
  bubbleId: string;
}

const activityTypes = [
  { type: 'available', label: 'Available', icon: Smile, emoji: '😊' },
  { type: 'coffee', label: 'Getting Coffee', icon: Coffee, emoji: '☕' },
  { type: 'working', label: 'Working', icon: Briefcase, emoji: '💼' },
  { type: 'music', label: 'Listening to Music', icon: Music, emoji: '🎵' },
  { type: 'gaming', label: 'Gaming', icon: GamepadIcon, emoji: '🎮' },
  { type: 'reading', label: 'Reading', icon: BookOpen, emoji: '📚' },
];

export const StatusUpdates: React.FC<StatusUpdatesProps> = ({ bubbleId }) => {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [newStatus, setNewStatus] = useState('');
  const [selectedActivity, setSelectedActivity] = useState(activityTypes[0]);
  const [isPosting, setIsPosting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchStatuses();
    
    // Set up real-time subscription
    const channel = supabase
      .channel(`status-updates-${bubbleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'status_updates',
          filter: `bubble_id=eq.${bubbleId}`,
        },
        () => {
          fetchStatuses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bubbleId]);

  const fetchStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('status_updates')
        .select(`
          *,
          profile:profiles(first_name, profile_photo_url),
          reactions:status_reactions(*)
        `)
        .eq('bubble_id', bubbleId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setStatuses(data || []);
    } catch (error) {
      console.error('Error fetching statuses:', error);
    }
  };

  const postStatus = async () => {
    if (!newStatus.trim()) return;

    setIsPosting(true);
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 4); // Status expires in 4 hours

      const { error } = await supabase
        .from('status_updates')
        .insert({
          user_id: user?.id,
          bubble_id: bubbleId,
          status_text: newStatus,
          emoji: selectedActivity.emoji,
          activity_type: selectedActivity.type,
          expires_at: expiresAt.toISOString(),
        });

      if (error) throw error;

      setNewStatus('');
      toast({
        title: 'Status updated',
        description: 'Your status has been shared with the bubble.',
      });

    } catch (error) {
      console.error('Error posting status:', error);
      toast({
        title: 'Error',
        description: 'Failed to post status update.',
        variant: 'destructive',
      });
    } finally {
      setIsPosting(false);
    }
  };

  const reactToStatus = async (statusId: string, reactionType: string) => {
    try {
      // Check if user already reacted
      const { data: existingReaction } = await supabase
        .from('status_reactions')
        .select('id')
        .eq('status_id', statusId)
        .eq('user_id', user?.id)
        .maybeSingle();

      if (existingReaction) {
        // Remove existing reaction
        await supabase
          .from('status_reactions')
          .delete()
          .eq('id', existingReaction.id);
      } else {
        // Add new reaction
        await supabase
          .from('status_reactions')
          .insert({
            status_id: statusId,
            user_id: user?.id,
            reaction_type: reactionType,
          });
      }

    } catch (error) {
      console.error('Error reacting to status:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Post New Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Share Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Activity Type Selector */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {activityTypes.map((activity) => (
              <Button
                key={activity.type}
                variant={selectedActivity.type === activity.type ? "default" : "outline"}
                size="sm"
                className="flex flex-col gap-1 h-auto py-3"
                onClick={() => setSelectedActivity(activity)}
              >
                <span className="text-lg">{activity.emoji}</span>
                <span className="text-xs">{activity.label.split(' ')[0]}</span>
              </Button>
            ))}
          </div>

          {/* Status Input */}
          <div className="flex gap-2">
            <Input
              placeholder={`What are you up to? (${selectedActivity.label})`}
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && postStatus()}
              maxLength={140}
            />
            <Button 
              onClick={postStatus} 
              disabled={!newStatus.trim() || isPosting}
            >
              {isPosting ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {statuses.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No recent status updates
            </p>
          ) : (
            <div className="space-y-4">
              {statuses.map((status) => (
                <div key={status.id} className="border rounded-lg p-4 space-y-3">
                  {/* Status Header */}
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={status.profile?.profile_photo_url || undefined} />
                      <AvatarFallback>
                        {status.profile?.first_name?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{status.profile?.first_name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {status.emoji} {activityTypes.find(a => a.type === status.activity_type)?.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(status.created_at))} ago
                      </p>
                    </div>
                  </div>

                  {/* Status Content */}
                  <p className="text-sm ml-11">{status.status_text}</p>

                  {/* Reactions */}
                  <div className="flex items-center gap-2 ml-11">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => reactToStatus(status.id, 'like')}
                    >
                      <Heart className="h-4 w-4 mr-1" />
                      {status.reactions?.filter(r => r.reaction_type === 'like').length || 0}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => reactToStatus(status.id, 'support')}
                    >
                      <MessageCircle className="h-4 w-4 mr-1" />
                      {status.reactions?.filter(r => r.reaction_type === 'support').length || 0}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};