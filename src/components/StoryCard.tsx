import React, { useState, useEffect, useCallback, memo } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, MessageCircle, Eye, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ProgressiveImage } from '@/components/ProgressiveImage';

interface StoryCardProps {
  story: {
    id: string;
    created_at: string;
    description: string;
    reporter_id: string;
    profiles?: {
      first_name: string;
      profile_photo_url: string;
    };
  };
}

interface Comment {
  id: string;
  comment_text: string;
  created_at: string;
  user_id: string;
  profiles?: {
    first_name: string;
    profile_photo_url: string;
  };
}

export const StoryCard: React.FC<StoryCardProps> = memo(({ story }) => {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);

  const fetchStoryData = useCallback(async () => {
    // Fetch reactions
    const { data: reactions } = await supabase
      .from('story_reactions')
      .select('*')
      .eq('story_id', story.id);

    if (reactions) {
      setLikesCount(reactions.length);
      setLiked(reactions.some(r => r.user_id === user?.id));
    }

    // Fetch views
    const { data: views } = await supabase
      .from('story_views')
      .select('*')
      .eq('story_id', story.id);

    if (views) {
      setViewsCount(views.length);
    }

    // Fetch comments
    const { data: commentsData } = await supabase
      .from('story_comments')
      .select('*')
      .eq('story_id', story.id)
      .order('created_at', { ascending: false });

    if (commentsData) {
      // Fetch profiles for commenters
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, profile_photo_url')
        .in('id', userIds);

      const commentsWithProfiles = commentsData.map(comment => ({
        ...comment,
        profiles: profilesData?.find(p => p.id === comment.user_id)
      }));

      setComments(commentsWithProfiles);
      setCommentsCount(commentsData.length);
    }
  }, [story.id, user?.id]);

  const trackView = useCallback(async () => {
    if (!user?.id || user.id === story.reporter_id) return;

    await supabase
      .from('story_views')
      .insert({
        story_id: story.id,
        viewer_id: user.id
      })
      .select()
      .single();
  }, [user?.id, story.id, story.reporter_id]);


  const handleLike = async () => {
    if (!user?.id) return;

    if (liked) {
      await supabase
        .from('story_reactions')
        .delete()
        .eq('story_id', story.id)
        .eq('user_id', user.id);
      
      setLiked(false);
      setLikesCount(prev => prev - 1);
    } else {
      await supabase
        .from('story_reactions')
        .insert({
          story_id: story.id,
          user_id: user.id,
          reaction_type: 'like'
        });
      
      setLiked(true);
      setLikesCount(prev => prev + 1);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !newComment.trim()) return;

    const { error } = await supabase
      .from('story_comments')
      .insert({
        story_id: story.id,
        user_id: user.id,
        comment_text: newComment.trim()
      });

    if (error) {
      toast.error('Failed to post comment');
      return;
    }

    setNewComment('');
    fetchStoryData();
    toast.success('Comment posted!');
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={story.profiles?.profile_photo_url} />
            <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-white">
              {story.profiles?.first_name?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{story.profiles?.first_name || 'User'}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-sm">{story.description}</p>
      </CardContent>

      <CardFooter className="flex flex-col gap-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={`gap-2 ${liked ? 'text-red-500' : ''}`}
            >
              <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
              <span>{likesCount}</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComments(!showComments)}
              className="gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              <span>{commentsCount}</span>
            </Button>
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span className="text-sm">{viewsCount}</span>
            </div>
          </div>
        </div>

        {showComments && (
          <div className="w-full space-y-3">
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-2 text-sm">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={comment.profiles?.profile_photo_url} />
                    <AvatarFallback className="text-xs">
                      {comment.profiles?.first_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <span className="font-semibold">{comment.profiles?.first_name}</span>
                    <p className="text-muted-foreground">{comment.comment_text}</p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleComment} className="flex gap-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1"
              />
              <Button type="submit" size="sm">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        )}
      </CardFooter>
    </Card>
  );
});

StoryCard.displayName = 'StoryCard';
