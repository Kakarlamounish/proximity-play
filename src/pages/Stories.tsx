import React, { useState, useEffect } from 'react';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import CreateStoryDialog from '@/components/CreateStoryDialog';
import { StoryCard } from '@/components/StoryCard';
import { useLocation } from '@/hooks/useLocation';

const Stories = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storyDialogOpen, setStoryDialogOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const { latitude, longitude } = useLocation();

  useEffect(() => {
    fetchStories();
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (data) {
        setProfile({
          ...data,
          email: user.email,
          app_metadata: user.app_metadata,
          user_metadata: user.user_metadata,
          aud: user.aud,
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchStories = async () => {
    try {
      const { data } = await supabase
        .from('user_reports')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) {
        // Fetch profiles for all story creators
        const userIds = [...new Set(data.map(s => s.reporter_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, profile_photo_url')
          .in('id', userIds);

        const storiesWithProfiles = data.map(story => ({
          id: story.id,
          created_at: story.created_at,
          description: story.description || `Report: ${story.reason}`,
          reporter_id: story.reporter_id,
          profiles: profilesData?.find(p => p.id === story.reporter_id)
        }));

        setStories(storiesWithProfiles);
      }
    } catch (error) {
      console.error('Error fetching stories:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-primary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-primary">
      <Navigation profile={profile} />
      <CreateStoryDialog
        open={storyDialogOpen}
        onClose={() => {
          setStoryDialogOpen(false);
          fetchStories();
        }}
        userLocation={[latitude, longitude]}
      />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
              Stories
            </h1>
            <Button onClick={() => setStoryDialogOpen(true)} className="gap-2 bg-gradient-to-r from-secondary to-primary">
              <PlusCircle className="h-5 w-5" />
              New Story
            </Button>
          </div>

          <div className="space-y-4">
            {stories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}

            {stories.length === 0 && (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground mb-4">No stories yet</p>
                <Button onClick={() => setStoryDialogOpen(true)} className="bg-gradient-to-r from-secondary to-primary">
                  <PlusCircle className="h-5 w-5 mr-2" />
                  Share Your First Story
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stories;
