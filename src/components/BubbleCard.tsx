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

type Bubble = Database['public']['Tables']['bubbles']['Row'] & {
  distance?: number;
  is_member?: boolean;
};

interface BubbleCardProps {
  bubble: Bubble;
  onJoin?: (bubbleId: string) => void;
  onLeave?: (bubbleId: string) => void;
  onChat?: (bubbleId: string) => void;
}

export const BubbleCard: React.FC<BubbleCardProps> = ({ 
  bubble, 
  onJoin, 
  onLeave, 
  onChat 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isMember, setIsMember] = useState(bubble.is_member || false);

  const handleJoinLeave = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      if (isMember) {
        // Leave bubble
        const { error } = await supabase
          .from('bubble_memberships')
          .delete()
          .eq('user_id', user.id)
          .eq('bubble_id', bubble.id);

        if (error) throw error;

        setIsMember(false);
        onLeave?.(bubble.id);
        
        toast({
          title: 'Left bubble',
          description: `You left ${bubble.name}`,
        });
      } else {
        // Join bubble
        const { error } = await supabase
          .from('bubble_memberships')
          .insert({
            user_id: user.id,
            bubble_id: bubble.id,
          });

        if (error) throw error;

        setIsMember(true);
        onJoin?.(bubble.id);
        
        toast({
          title: 'Joined bubble!',
          description: `Welcome to ${bubble.name}`,
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
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
    <Card className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border-0 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 bg-gradient-to-br from-secondary to-primary">
              <AvatarFallback className="text-white font-semibold">
                {bubble.interest_tag[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{bubble.name}</CardTitle>
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