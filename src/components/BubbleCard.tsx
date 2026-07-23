import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MapPin, Users, MessageCircle, Calendar, Trash2, MoreVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseCache } from '@/hooks/useCache';
import { ShareBubbleDialog } from '@/components/ShareBubbleDialog';
import { motion } from 'framer-motion';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  onDelete?: (bubbleId: string) => void;
  showTrendingBadge?: boolean;
}

export const BubbleCard: React.FC<BubbleCardProps> = ({
  bubble,
  onJoin,
  onLeave,
  onChat,
  onDelete,
  showTrendingBadge = false
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const haptic = useHapticFeedback();
  const [isLoading, setIsLoading] = useState(false);
  const [isMember, setIsMember] = useState(bubble.is_member || false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Re-sync when the parent's copy of this bubble changes membership (e.g.
  // the same bubble is also rendered in a second list — Dashboard shows a
  // bubble in both "Hot Right Now" and "Nearby Bubbles" when it qualifies
  // for both — and the user joins/leaves from the other card). Without
  // this, this already-mounted card's local `isMember` never updates even
  // though the parent's state and this card's own `bubble` prop did.
  useEffect(() => {
    setIsMember(bubble.is_member || false);
  }, [bubble.is_member]);

  const isCreator = user?.id === bubble.creator_id;

  const handleDeleteBubble = async () => {
    if (!user || !isCreator) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('bubbles')
        .delete()
        .eq('id', bubble.id);

      if (error) throw error;

      toast({
        title: 'Bubble deleted',
        description: `"${bubble.name}" has been deleted`,
      });

      haptic.medium();
      onDelete?.(bubble.id);
      setShowDeleteDialog(false);
    } catch (error: any) {
      console.error('Error deleting bubble:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete bubble',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

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
        haptic.light();
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
        haptic.success();
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border-0 glass ${bubble.trending ? 'ring-2 ring-orange-400/50 shadow-orange-400/20' : ''}`}>
        <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 bg-gradient-to-br from-secondary to-primary">
              <AvatarFallback className="text-white font-semibold">
                {(bubble.interest_tag?.[0] || '?').toUpperCase()}
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
          <motion.div whileTap={{ scale: 0.95 }} className={isMember ? "flex-1" : "flex-1 flex"}>
            <Button
              onClick={handleJoinLeave}
              disabled={isLoading}
              className={
                isMember
                  ? "w-full"
                  : "w-full bg-gradient-to-r from-secondary to-primary hover:from-secondary-dark hover:to-primary-dark"
              }
              variant={isMember ? "outline" : "default"}
            >
              {isLoading ? '...' : isMember ? 'Leave' : 'Join'}
            </Button>
          </motion.div>
          
          {isMember && (
            <>
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => onChat?.(bubble.id)}
                  variant="outline"
                  size="icon"
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </motion.div>
              <motion.div whileTap={{ scale: 0.95 }}>
                <ShareBubbleDialog 
                  bubbleId={bubble.id} 
                  bubbleName={bubble.name} 
                  isCreator={isCreator} 
                />
              </motion.div>
              {isCreator && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <motion.button whileTap={{ scale: 0.95 }}>
                      <Button variant="outline" size="icon" asChild>
                        <span>
                          <MoreVertical className="h-4 w-4" />
                        </span>
                      </Button>
                    </motion.button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Bubble
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{bubble.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the bubble
                and remove all members.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteBubble}
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
    </motion.div>
  );
};