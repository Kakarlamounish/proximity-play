import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MapPin, Users, MessageCircle, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

import type { Database } from '@/integrations/supabase/types';

interface BubbleCardProps {
  bubble: {
    id: string;
    name: string;
    description?: string;
    interest_tag: string;
    member_count: number;
    latitude: number;
    longitude: number;
    created_at: string;
    creator_id: string;
    is_private: boolean;
    updated_at: string;
    is_member?: boolean;
    trending?: boolean;
    distance?: number;
  };
  onJoin?: (bubbleId: string) => void;
  onLeave?: (bubbleId: string) => void;
  onChat?: (bubbleId: string) => void;
  showTrendingBadge?: boolean;
}

export const BubbleCard: React.FC<BubbleCardProps> = ({
  bubble,
  onJoin,
  onLeave,
  onChat,
  showTrendingBadge = false
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isMember, setIsMember] = useState(bubble.is_member || false);

  const handleJoinLeave = async () => {
    if (!user) return;

    console.log('BubbleCard: Handling join/leave for bubble:', bubble.id, 'current member status:', isMember);
    setIsLoading(true);
    try {
      if (isMember) {
        // Leave bubble
        console.log('BubbleCard: Leaving bubble');
        const { error, count } = await supabase
          .from('bubble_memberships')
          .delete({ count: 'exact' })
          .eq('user_id', user.id)
          .eq('bubble_id', bubble.id);

        if (error) {
          console.error('BubbleCard: Error leaving bubble:', error);
          throw error;
        }

        console.log('BubbleCard: Successfully left bubble, deleted rows:', count);
        setIsMember(false);
        onLeave?.(bubble.id);

        toast({
          title: 'Left bubble',
          description: `You left ${bubble.name}`,
        });
      } else {
        // Join bubble
        console.log('BubbleCard: Joining bubble');
        const { error, data } = await supabase
          .from('bubble_memberships')
          .insert({
            user_id: user.id,
            bubble_id: bubble.id,
          })
          .select();

        if (error) {
          console.error('BubbleCard: Error joining bubble:', error);
          throw error;
        }

        console.log('BubbleCard: Successfully joined bubble, inserted data:', data);
        setIsMember(true);
        onJoin?.(bubble.id);

        toast({
          title: 'Joined bubble!',
          description: `Welcome to ${bubble.name}`,
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      console.error('BubbleCard: Join/leave operation failed:', errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDistance = (distance?: number) => {
    if (!distance) return '';
    if (distance < 1) return `${Math.round(distance * 1000)}m away`;
    return `${distance.toFixed(1)}km away`;
  };

  return (
    <Card className={`hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border-0 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm ${bubble.trending ? 'ring-2 ring-orange-400/50 shadow-orange-400/20' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 bg-gradient-to-br from-secondary to-primary">
              <AvatarFallback className="text-white font-semibold">
                {bubble.interest_tag[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {bubble.name}
                {bubble.trending && (
                  <Badge variant="destructive" className="text-xs bg-gradient-to-r from-orange-500 to-red-500">
                    🔥 Hot
                  </Badge>
                )}
              </CardTitle>
              <Badge variant="secondary" className="mt-1">
                {bubble.interest_tag}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{bubble.member_count} members</span>
          </div>
          
          {bubble.distance && (
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>{formatDistance(bubble.distance)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleJoinLeave}
            disabled={isLoading}
            className={
              isMember
                ? "flex-1"
                : "flex-1 bg-gradient-to-r from-secondary to-primary hover:from-secondary-dark hover:to-primary-dark"
            }
            variant={isMember ? "outline" : "default"}
          >
            {isLoading ? '...' : isMember ? 'Leave' : 'Join'}
          </Button>
          
          {isMember && (
            <>
              <Button
                onClick={() => onChat?.(bubble.id)}
                variant="outline"
                size="icon"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
              >
                <Calendar className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};