import React, { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
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

  // Hoisted function declarations (were const before -> caused runtime ReferenceError)
  async function fetchProfile() {
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
  }

  async function fetchStories() {
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
  }

  useEffect(() => {
    fetchStories();
    fetchProfile();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-primary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Navigation />
      <CreateStoryDialog
        open={storyDialogOpen}
        onClose={() => {
          setStoryDialogOpen(false);
          fetchStories();
        }}
        // guard against passing [null, null] — pass null when location is not available
        userLocation={latitude != null && longitude != null ? [latitude, longitude] : null}
      />
      <main className="page-stories px-8 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold">Stories</h1>
        </header>

        <section className="stories-content">
          <div className="stories-card bg-neutral-800 rounded-xl p-8">
            <div className="text-center text-neutral-400 mb-4">No stories yet</div>
            <div className="flex justify-center">
              <Button onClick={() => setStoryDialogOpen(true)} className="gap-2 bg-gradient-to-r from-secondary to-primary">
                <PlusCircle className="h-5 w-5" />
                Share Your First Story
              </Button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default Stories;
