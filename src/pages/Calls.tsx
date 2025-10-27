import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  Video, 
  PhoneCall, 
  Users, 
  Clock,
  Loader2 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { VideoCall } from '@/components/VideoCall';

const Calls = () => {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<Database['public']['Tables']['profiles']['Row'] | null>(null);
  const [userBubbles, setUserBubbles] = useState<Database['public']['Tables']['bubbles']['Row'][]>([]);
  const [activeCall, setActiveCall] = useState<{ bubbleId: string; type: 'audio' | 'video' } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

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

        // Fetch user bubbles with recent activity
        const { data: bubblesData } = await supabase
          .from('bubble_memberships')
          .select(`
            bubble:bubbles(*),
            created_at
          `)
          .eq('user_id', user.id);

        const bubbles = bubblesData?.map(m => m.bubble).filter(Boolean) || [];
        setUserBubbles(bubbles);

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setPageLoading(false);
      }
    };

    if (user && !loading) {
      fetchData();
    }
  }, [user, loading]);

  if (!user && !loading) {
    return <Navigate to="/auth" replace />;
  }

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-primary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const startCall = (bubbleId: string, type: 'audio' | 'video') => {
    console.log('Starting call:', { bubbleId, type });
    setActiveCall({ bubbleId, type });
  };

  const endCall = () => {
    setActiveCall(null);
  };

  if (activeCall) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <VideoCall
          bubbleId={activeCall.bubbleId}
          callType={activeCall.type}
          isInitiator={true}
          onCallEnd={endCall}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-primary">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">
              Voice & Video Calls
              <PhoneCall className="inline-block ml-2 h-8 w-8 text-primary" />
            </h1>
            <p className="text-lg text-muted-foreground">
              Connect with your bubble members through audio and video calls
            </p>
          </div>

          {userBubbles.length === 0 ? (
            <Card className="backdrop-blur-sm bg-card/95 border-0">
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No bubbles joined</h3>
                <p className="text-muted-foreground mb-4">
                  Join a bubble to make voice and video calls with other members
                </p>
                <Button onClick={() => window.location.href = '/'}>
                  Find Bubbles
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Call History */}
              <Card className="backdrop-blur-sm bg-card/95 border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Calls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <PhoneCall className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No recent calls</p>
                  </div>
                </CardContent>
              </Card>

              {/* Available Bubbles for Calling */}
              <Card className="backdrop-blur-sm bg-card/95 border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Your Bubbles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {userBubbles.map((bubble) => (
                      <div key={bubble.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-white">
                              {bubble.name[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-medium">{bubble.name}</h3>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {bubble.interest_tag}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {bubble.member_count} members
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startCall(bubble.id, 'audio')}
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            Audio
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startCall(bubble.id, 'video')}
                          >
                            <Video className="h-4 w-4 mr-2" />
                            Video
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Call Features Info */}
              <Card className="backdrop-blur-sm bg-card/95 border-0">
                <CardHeader>
                  <CardTitle>Call Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <Phone className="h-8 w-8 text-primary mb-2" />
                      <h4 className="font-medium mb-2">Audio Calls</h4>
                      <p className="text-sm text-muted-foreground">
                        High-quality voice calls with bubble members using WebRTC technology
                      </p>
                    </div>
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <Video className="h-8 w-8 text-primary mb-2" />
                      <h4 className="font-medium mb-2">Video Calls</h4>
                      <p className="text-sm text-muted-foreground">
                        Face-to-face conversations with screen sharing and recording capabilities
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calls;