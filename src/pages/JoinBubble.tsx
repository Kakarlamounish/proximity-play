import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, MapPin, CheckCircle, XCircle, LogIn } from 'lucide-react';

interface BubbleInfo {
  id: string;
  name: string;
  description: string | null;
  interest_tag: string;
  member_count: number;
  is_private: boolean;
}

const JoinBubble = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bubble, setBubble] = useState<BubbleInfo | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const fetchInviteDetails = async () => {
      if (!inviteCode) {
        setError('Invalid invite link');
        setLoading(false);
        return;
      }

      try {
        // Fetch invite details
        const { data: invite, error: inviteError } = await supabase
          .from('bubble_invites')
          .select('*')
          .eq('invite_code', inviteCode)
          .eq('is_active', true)
          .single();

        if (inviteError || !invite) {
          setError('This invite link is invalid or has expired');
          setLoading(false);
          return;
        }

        // Check if expired
        if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
          setError('This invite link has expired');
          setLoading(false);
          return;
        }

        // Check if max uses reached
        if (invite.max_uses && invite.uses >= invite.max_uses) {
          setError('This invite link has reached its maximum usage limit');
          setLoading(false);
          return;
        }

        // Fetch bubble details
        const { data: bubbleData, error: bubbleError } = await supabase
          .from('bubbles')
          .select('*')
          .eq('id', invite.bubble_id)
          .single();

        if (bubbleError || !bubbleData) {
          setError('The bubble associated with this invite no longer exists');
          setLoading(false);
          return;
        }

        setBubble(bubbleData);

        // Check if user is already a member
        if (user) {
          const { data: membership } = await supabase
            .from('bubble_memberships')
            .select('id')
            .eq('bubble_id', invite.bubble_id)
            .eq('user_id', user.id)
            .single();

          if (membership) {
            setAlreadyMember(true);
          }
        }
      } catch (err) {
        console.error('Error fetching invite details:', err);
        setError('Failed to load invite details');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchInviteDetails();
    }
  }, [inviteCode, user, authLoading]);

  const handleJoin = async () => {
    if (!user) {
      // Redirect to auth with return URL
      navigate(`/auth?returnTo=/join/${inviteCode}`);
      return;
    }

    if (!bubble || !inviteCode) return;

    setJoining(true);
    try {
      // Join the bubble
      const { error: joinError } = await supabase
        .from('bubble_memberships')
        .insert({
          bubble_id: bubble.id,
          user_id: user.id,
        });

      if (joinError) {
        if (joinError.code === '23505') {
          // Duplicate key - already a member
          setAlreadyMember(true);
        } else {
          throw joinError;
        }
      } else {
        // Increment invite uses
        await supabase
          .from('bubble_invites')
          .update({ uses: supabase.rpc ? undefined : 1 }) // Will be handled differently
          .eq('invite_code', inviteCode);

        // Update uses count
        const { data: currentInvite } = await supabase
          .from('bubble_invites')
          .select('uses')
          .eq('invite_code', inviteCode)
          .single();

        if (currentInvite) {
          await supabase
            .from('bubble_invites')
            .update({ uses: (currentInvite.uses || 0) + 1 })
            .eq('invite_code', inviteCode);
        }

        setJoined(true);
        toast({
          title: 'Welcome!',
          description: `You've joined "${bubble.name}"`,
        });

        // Create notification for bubble creator
        const { data: bubbleData } = await supabase
          .from('bubbles')
          .select('creator_id, name')
          .eq('id', bubble.id)
          .single();

        if (bubbleData && bubbleData.creator_id !== user.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name')
            .eq('id', user.id)
            .single();

          await supabase.from('notifications').insert({
            user_id: bubbleData.creator_id,
            type: 'bubble_join',
            title: 'New member joined!',
            body: `${profile?.first_name || 'Someone'} joined your bubble "${bubbleData.name}"`,
            data: { bubble_id: bubble.id, user_id: user.id },
          });
        }
      }
    } catch (err: any) {
      console.error('Error joining bubble:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to join bubble',
        variant: 'destructive',
      });
    } finally {
      setJoining(false);
    }
  };

  const goToBubble = () => {
    navigate('/messages', { state: { selectedBubbleId: bubble?.id } });
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-primary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-primary p-4">
        <Card className="max-w-md w-full backdrop-blur-sm bg-card/95 border-0">
          <CardContent className="p-8 text-center">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Invalid Invite</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => navigate('/')} variant="outline">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!bubble) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-primary p-4">
      <Card className="max-w-md w-full backdrop-blur-sm bg-card/95 border-0">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {joined ? 'Welcome!' : alreadyMember ? "You're already a member" : "You're invited!"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bubble Info */}
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-secondary to-primary mx-auto flex items-center justify-center">
              <span className="text-3xl text-white font-bold">
                {bubble.interest_tag[0].toUpperCase()}
              </span>
            </div>
            <h3 className="text-xl font-semibold">{bubble.name}</h3>
            <Badge variant="secondary">{bubble.interest_tag}</Badge>
            {bubble.description && (
              <p className="text-muted-foreground text-sm">{bubble.description}</p>
            )}
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{bubble.member_count} members</span>
              </div>
            </div>
          </div>

          {/* Action */}
          {joined ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center text-green-500">
                <CheckCircle className="h-12 w-12" />
              </div>
              <Button onClick={goToBubble} className="w-full">
                Go to Bubble Chat
              </Button>
            </div>
          ) : alreadyMember ? (
            <div className="space-y-4">
              <p className="text-center text-muted-foreground">
                You're already a member of this bubble.
              </p>
              <Button onClick={goToBubble} className="w-full">
                Go to Bubble Chat
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {!user && (
                <p className="text-center text-muted-foreground text-sm">
                  Sign in to join this bubble
                </p>
              )}
              <Button
                onClick={handleJoin}
                disabled={joining}
                className="w-full bg-gradient-to-r from-secondary to-primary"
              >
                {joining ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : !user ? (
                  <LogIn className="h-4 w-4 mr-2" />
                ) : null}
                {joining ? 'Joining...' : !user ? 'Sign in to Join' : 'Join Bubble'}
              </Button>
            </div>
          )}

          <Button variant="ghost" onClick={() => navigate('/')} className="w-full">
            Go to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default JoinBubble;
