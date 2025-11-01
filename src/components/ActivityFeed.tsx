import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle, Calendar, Users, UserPlus, Sparkles, Heart, Share } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
  id: string;
  type: 'message' | 'meetup' | 'join' | 'create';
  content: string;
  created_at: string;
  user_id: string;
  bubble_id?: string;
  meetup_id?: string;
  user?: {
    first_name: string;
    profile_photo_url?: string;
  };
  bubble?: {
    name: string;
    interest_tag: string;
  };
  meetup?: {
    title: string;
  };
}

interface ActivityFeedProps {
  limit?: number;
  showTitle?: boolean;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ limit = 10, showTitle = true }) => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      if (!user) return;

      try {
        // Get user's joined bubbles
        const { data: membershipData } = await supabase
          .from('bubble_memberships')
          .select('bubble_id')
          .eq('user_id', user.id);

        const bubbleIds = membershipData?.map(m => m.bubble_id) || [];

        if (bubbleIds.length === 0) {
          setActivities([]);
          setLoading(false);
          return;
        }

        // Create mock activities based on recent messages and meetups
        const activities: Activity[] = [];

        // Recent messages in user's bubbles
        const { data: messagesData } = await supabase
          .from('messages')
          .select('id, content, created_at, sender_id, bubble_id')
          .in('bubble_id', bubbleIds)
          .neq('sender_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (messagesData && messagesData.length > 0) {
          // Get sender profiles
          const senderIds = [...new Set(messagesData.map(msg => msg.sender_id))];
          const { data: senderProfiles } = await supabase
            .from('profiles')
            .select('id, first_name, profile_photo_url')
            .in('id', senderIds);

          // Get bubble info
          const msgBubbleIds = [...new Set(messagesData.map(msg => msg.bubble_id))];
          const { data: bubbleInfo } = await supabase
            .from('bubbles')
            .select('id, name, interest_tag')
            .in('id', msgBubbleIds);

          const senderMap = new Map(senderProfiles?.map(p => [p.id, p]) || []);
          const bubbleMap = new Map(bubbleInfo?.map(b => [b.id, b]) || []);

          messagesData.forEach(msg => {
            const sender = senderMap.get(msg.sender_id) as any;
            const bubble = bubbleMap.get(msg.bubble_id!) as any;
            activities.push({
              id: `msg-${msg.id}`,
              type: 'message',
              content: msg.content.length > 80 ? msg.content.substring(0, 80) + '...' : msg.content,
              created_at: msg.created_at!,
              user_id: msg.sender_id,
              bubble_id: msg.bubble_id!,
              user: sender ? { first_name: sender.first_name, profile_photo_url: sender.profile_photo_url } : undefined,
              bubble: bubble ? { name: bubble.name, interest_tag: bubble.interest_tag } : undefined
            });
          });
        }

        // Recent meetups in user's bubbles
        const { data: meetupsData } = await supabase
          .from('meetups')
          .select('id, title, created_at, organizer_id, bubble_id')
          .in('bubble_id', bubbleIds)
          .neq('organizer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3);

        if (meetupsData && meetupsData.length > 0) {
          // Get organizer profiles
          const organizerIds = [...new Set(meetupsData.map(m => m.organizer_id))];
          const { data: organizerProfiles } = await supabase
            .from('profiles')
            .select('id, first_name, profile_photo_url')
            .in('id', organizerIds);

          // Get bubble info
          const meetupBubbleIds = [...new Set(meetupsData.map(m => m.bubble_id))];
          const { data: bubbleInfo } = await supabase
            .from('bubbles')
            .select('id, name, interest_tag')
            .in('id', meetupBubbleIds);

          const organizerMap = new Map(organizerProfiles?.map(p => [p.id, p]) || []);
          const bubbleMap = new Map(bubbleInfo?.map(b => [b.id, b]) || []);

          meetupsData.forEach(meetup => {
            const organizer = organizerMap.get(meetup.organizer_id) as any;
            const bubble = bubbleMap.get(meetup.bubble_id) as any;
            activities.push({
              id: `meetup-${meetup.id}`,
              type: 'meetup',
              content: meetup.title,
              created_at: meetup.created_at!,
              user_id: meetup.organizer_id,
              bubble_id: meetup.bubble_id,
              meetup_id: meetup.id,
              user: organizer ? { first_name: organizer.first_name, profile_photo_url: organizer.profile_photo_url } : undefined,
              bubble: bubble ? { name: bubble.name, interest_tag: bubble.interest_tag } : undefined,
              meetup: { title: meetup.title }
            });
          });
        }

        // Recent memberships in user's bubbles
        const { data: membershipsData } = await supabase
          .from('bubble_memberships')
          .select('id, created_at, user_id, bubble_id')
          .in('bubble_id', bubbleIds)
          .neq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (membershipsData && membershipsData.length > 0) {
          // Get member profiles
          const memberIds = [...new Set(membershipsData.map(m => m.user_id))];
          const { data: memberProfiles } = await supabase
            .from('profiles')
            .select('id, first_name, profile_photo_url')
            .in('id', memberIds);

          // Get bubble info
          const membershipBubbleIds = [...new Set(membershipsData.map(m => m.bubble_id))];
          const { data: bubbleInfo } = await supabase
            .from('bubbles')
            .select('id, name, interest_tag')
            .in('id', membershipBubbleIds);

          const memberMap = new Map(memberProfiles?.map(p => [p.id, p]) || []);
          const bubbleMap = new Map(bubbleInfo?.map(b => [b.id, b]) || []);

          membershipsData.forEach(membership => {
            const bubble = bubbleMap.get(membership.bubble_id) as any;
            const member = memberMap.get(membership.user_id) as any;
            activities.push({
              id: `join-${membership.id}`,
              type: 'join',
              content: `joined ${bubble?.name || 'a bubble'}`,
              created_at: membership.created_at!,
              user_id: membership.user_id,
              bubble_id: membership.bubble_id,
              user: member ? { first_name: member.first_name, profile_photo_url: member.profile_photo_url } : undefined,
              bubble: bubble ? { name: bubble.name, interest_tag: bubble.interest_tag } : undefined
            });
          });
        }

        // Sort all activities by created_at
        activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setActivities(activities.slice(0, limit));
      } catch (error) {
        console.error('Error fetching activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [user, limit]);

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'message':
        return <MessageCircle className="h-4 w-4" />;
      case 'meetup':
        return <Calendar className="h-4 w-4" />;
      case 'join':
        return <UserPlus className="h-4 w-4" />;
      case 'create':
        return <Sparkles className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getActivityText = (activity: Activity) => {
    switch (activity.type) {
      case 'message':
        return `sent a message in ${activity.bubble?.name}`;
      case 'meetup':
        return `created a meetup in ${activity.bubble?.name}`;
      case 'join':
        return activity.content;
      case 'create':
        return `created ${activity.bubble?.name}`;
      default:
        return activity.content;
    }
  };

  if (loading) {
    return (
      <Card className="backdrop-blur-sm bg-card/95 border-0">
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-start gap-3">
                <div className="h-10 w-10 bg-muted rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-sm bg-card/95 border-0">
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
      )}
      
      <CardContent className={showTitle ? "pt-0" : "p-6"}>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No recent activity in your bubbles</p>
            <p className="text-sm">Join more bubbles to see updates!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 group">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={activity.user?.profile_photo_url} />
                  <AvatarFallback className="bg-gradient-to-br from-secondary to-primary text-white">
                    {activity.user?.first_name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{activity.user?.first_name}</span>
                        {' '}
                        <span className="text-muted-foreground">
                          {getActivityText(activity)}
                        </span>
                      </p>
                      
                      {activity.type === 'message' && (
                        <p className="text-sm text-foreground mt-1 bg-muted/50 rounded p-2">
                          "{activity.content}"
                        </p>
                      )}
                      
                      {activity.type === 'meetup' && (
                        <p className="text-sm text-foreground mt-1 bg-primary/10 rounded p-2">
                          📅 {activity.meetup?.title}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 mt-2">
                        {activity.bubble && (
                          <Badge variant="secondary" className="text-xs">
                            {activity.bubble.interest_tag}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <Heart className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <Share className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="text-primary/70">
                  {getActivityIcon(activity.type)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};