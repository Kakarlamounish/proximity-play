import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const Messages = () => {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [bubbles, setBubbles] = useState<any[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);

  // Redirect unauthenticated users
  if (!user && !loading) {
    return <Navigate to="/auth" replace />;
  }

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setProfile(profileData);

        // Fetch user's bubbles
        const { data: userBubbles } = await supabase
          .from('bubble_memberships')
          .select(`
            bubble_id,
            bubbles (
              id,
              name,
              interest_tag,
              member_count
            )
          `)
          .eq('user_id', user.id);

        setBubbles(userBubbles?.map(ub => ub.bubbles) || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setProfileLoading(false);
      }
    };

    if (user && !loading) {
      fetchData();
    }
  }, [user, loading]);

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-primary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-primary">
      <Navigation profile={profile} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Messages</h1>
            <p className="text-muted-foreground">Chat with your bubble communities</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chat List */}
            <div className="lg:col-span-1">
              <Card className="backdrop-blur-sm bg-card/95 border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Your Bubbles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {bubbles.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Join some bubbles to start chatting!
                      </p>
                    ) : (
                      bubbles.map((bubble) => (
                        <div
                          key={bubble.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <Avatar className="h-10 w-10 bg-gradient-to-br from-secondary to-primary">
                            <AvatarFallback className="text-white font-semibold">
                              {bubble.interest_tag[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{bubble.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {bubble.interest_tag}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {bubble.member_count}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Chat Area */}
            <div className="lg:col-span-2">
              <Card className="backdrop-blur-sm bg-card/95 border-0 h-[600px]">
                <CardContent className="p-0 h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">Select a bubble to start chatting</p>
                    <p className="text-sm">Connect with your community members in real-time</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Messages;