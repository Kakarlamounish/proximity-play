import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, Users, Calendar, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const Profile = () => {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [bubbles, setBubbles] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
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
            joined_at,
            bubbles (
              id,
              name,
              interest_tag,
              member_count
            )
          `)
          .eq('user_id', user.id);

        setBubbles(userBubbles || []);

        // Fetch user's badges
        const { data: userBadges } = await supabase
          .from('user_badges')
          .select(`
            earned_at,
            badges (
              name,
              description,
              icon
            )
          `)
          .eq('user_id', user.id);

        setBadges(userBadges || []);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-primary">
      <Navigation profile={profile} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <Card className="backdrop-blur-sm bg-card/95 border-0 mb-8">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-start gap-6">
                <Avatar className="h-24 w-24 mx-auto md:mx-0">
                  <AvatarImage src={profile?.profile_photo_url} />
                  <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-white text-2xl">
                    {profile?.first_name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 text-center md:text-left">
                  <h1 className="text-3xl font-bold mb-2">{profile?.first_name}</h1>
                  <p className="text-muted-foreground mb-4">Age: {profile?.age}</p>
                  
                  {profile?.bio && (
                    <p className="text-lg mb-4">"{profile.bio}"</p>
                  )}
                  
                  <div className="flex items-center justify-center md:justify-start gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{bubbles.length} bubbles</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Award className="h-4 w-4" />
                      <span>{badges.length} badges</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Joined {formatDate(profile?.created_at)}</span>
                    </div>
                  </div>
                  
                  <Button className="bg-gradient-to-r from-secondary to-primary hover:from-secondary-dark hover:to-primary-dark">
                    Edit Profile
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Interests */}
            <Card className="backdrop-blur-sm bg-card/95 border-0">
              <CardHeader>
                <CardTitle>Interests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile?.interests?.map((interest: string, index: number) => (
                    <Badge key={index} variant="secondary">
                      {interest}
                    </Badge>
                  )) || <p className="text-muted-foreground">No interests added</p>}
                </div>
              </CardContent>
            </Card>

            {/* Badges */}
            <Card className="backdrop-blur-sm bg-card/95 border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Badges
                </CardTitle>
              </CardHeader>
              <CardContent>
                {badges.length === 0 ? (
                  <p className="text-muted-foreground">No badges earned yet</p>
                ) : (
                  <div className="space-y-3">
                    {badges.map((userBadge, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <span className="text-2xl">{userBadge.badges.icon}</span>
                        <div>
                          <p className="font-medium">{userBadge.badges.name}</p>
                          <p className="text-sm text-muted-foreground">{userBadge.badges.description}</p>
                          <p className="text-xs text-muted-foreground">
                            Earned {formatDate(userBadge.earned_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active Bubbles */}
            <Card className="backdrop-blur-sm bg-card/95 border-0 lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Your Bubbles
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bubbles.length === 0 ? (
                  <p className="text-muted-foreground">You haven't joined any bubbles yet</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bubbles.map((membership) => (
                      <div key={membership.bubble_id} className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                        <Avatar className="h-12 w-12 bg-gradient-to-br from-secondary to-primary">
                          <AvatarFallback className="text-white font-semibold">
                            {membership.bubbles.interest_tag[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium">{membership.bubbles.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {membership.bubbles.interest_tag}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {membership.bubbles.member_count} members
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Joined {formatDate(membership.joined_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;