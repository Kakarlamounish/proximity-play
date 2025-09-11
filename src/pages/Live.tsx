import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  Activity, 
  Users, 
  Clock,
  Loader2 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Map from '@/components/Map';

const Live = () => {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [userBubbles, setUserBubbles] = useState<any[]>([]);
  const [selectedBubble, setSelectedBubble] = useState<any>(null);
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

        // Fetch user bubbles
        const { data: bubblesData } = await supabase
          .from('bubble_memberships')
          .select(`
            bubble:bubbles(*)
          `)
          .eq('user_id', user.id);

        const bubbles = bubblesData?.map(m => m.bubble).filter(Boolean) || [];
        setUserBubbles(bubbles);
        if (bubbles.length > 0) {
          setSelectedBubble(bubbles[0]);
        }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-primary">
      <Navigation profile={profile} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">
              Live Features
              <Activity className="inline-block ml-2 h-8 w-8 text-primary" />
            </h1>
            <p className="text-lg text-muted-foreground">
              Real-time location sharing, status updates, and live interactions
            </p>
          </div>

          {userBubbles.length === 0 ? (
            <Card className="backdrop-blur-sm bg-card/95 border-0">
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No bubbles joined</h3>
                <p className="text-muted-foreground mb-4">
                  Join a bubble to access live features and real-time interactions
                </p>
                <Button onClick={() => window.location.href = '/'}>
                  Find Bubbles
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Bubble Selector */}
              <Card className="backdrop-blur-sm bg-card/95 border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Your Bubbles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {userBubbles.map((bubble) => (
                      <Button
                        key={bubble.id}
                        variant={selectedBubble?.id === bubble.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedBubble(bubble)}
                        className="flex items-center gap-2"
                      >
                        <Badge variant="secondary" className="text-xs">
                          {bubble.interest_tag}
                        </Badge>
                        {bubble.name}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {selectedBubble && (
                <Tabs defaultValue="map" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="map" className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Live Map
                    </TabsTrigger>
                    <TabsTrigger value="status" className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Status Updates
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Live Activity
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="map">
                    <Card className="backdrop-blur-sm bg-card/95 border-0">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          Real-time Location Sharing - {selectedBubble.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="bg-primary/10 rounded-lg p-4">
                            <p className="text-sm text-muted-foreground mb-2">
                              <strong>Note:</strong> Live location sharing requires database updates that will be available after the next deployment.
                            </p>
                            <p className="text-sm text-muted-foreground">
                              This feature allows you to share your real-time location with bubble members and see who's nearby.
                            </p>
                          </div>
                          <Map 
                            bubbles={[selectedBubble]} 
                            showBubbles={true}
                            center={[selectedBubble.longitude, selectedBubble.latitude]}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="status">
                    <Card className="backdrop-blur-sm bg-card/95 border-0">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Activity className="h-5 w-5" />
                          Status Updates - {selectedBubble.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="bg-primary/10 rounded-lg p-4">
                            <p className="text-sm text-muted-foreground mb-2">
                              <strong>Coming Soon:</strong> Share your current activity and status with bubble members.
                            </p>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-4">
                              {['☕ Coffee', '💼 Working', '🎵 Music', '🎮 Gaming', '📚 Reading', '😊 Available'].map((status) => (
                                <Button key={status} variant="outline" size="sm" disabled>
                                  {status}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="activity">
                    <Card className="backdrop-blur-sm bg-card/95 border-0">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Clock className="h-5 w-5" />
                          Live Activity Feed - {selectedBubble.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="bg-primary/10 rounded-lg p-4">
                            <p className="text-sm text-muted-foreground mb-2">
                              <strong>Live Activity:</strong> See who's online, who's sharing location, and recent activities in real-time.
                            </p>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              <div>
                                <p className="font-medium">{profile?.first_name} (You)</p>
                                <p className="text-sm text-muted-foreground">Online • Last seen now</p>
                              </div>
                            </div>
                            
                            <div className="text-center py-8">
                              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                              <p className="text-muted-foreground">More live activity features coming soon!</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Live;