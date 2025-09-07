import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Redirect unauthenticated users to auth page
  if (!user && !loading) {
    return <Navigate to="/auth" replace />;
  }

  useEffect(() => {
    const checkProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching profile:', error);
        }

        setProfile(data);
        
        // If no profile exists, redirect to profile setup
        if (!data) {
          navigate('/profile-setup');
        }
      } catch (error) {
        console.error('Error checking profile:', error);
      } finally {
        setProfileLoading(false);
      }
    };

    if (user && !loading) {
      checkProfile();
    }
  }, [user, loading, navigate]);

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-primary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-primary">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
            Social Bubble
          </h1>
          <Button variant="outline" onClick={signOut}>
            Sign Out
          </Button>
        </div>

        <div className="text-center py-16">
          <h2 className="text-2xl font-bold mb-4">
            Welcome{profile?.first_name ? `, ${profile.first_name}` : ''}!
          </h2>
          <p className="text-muted-foreground mb-8">
            Your social bubbles are being prepared. Coming soon!
          </p>
          
          {profile && (
            <div className="bg-card/50 backdrop-blur-sm rounded-lg p-6 max-w-md mx-auto">
              <h3 className="font-semibold mb-2">Your Profile</h3>
              <p className="text-sm text-muted-foreground mb-2">Age: {profile.age}</p>
              {profile.bio && (
                <p className="text-sm text-muted-foreground mb-2">"{profile.bio}"</p>
              )}
              {profile.interests && profile.interests.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Interests:</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.interests.map((interest: string, index: number) => (
                      <span 
                        key={index}
                        className="px-2 py-1 bg-primary/20 text-primary rounded-full text-xs"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
