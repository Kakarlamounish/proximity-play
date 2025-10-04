import React, { useState, useEffect } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import CreateStoryDialog from '@/components/CreateStoryDialog';
import { useLocation } from '@/hooks/useLocation';

type Story = {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  text_content?: string;
  image_url?: string;
  filter_applied?: string;
  created_at: string;
  expires_at: string;
  profiles: {
    first_name: string | null;
    profile_photo_url: string | null;
  } | null;
};

const Stories = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [storyDialogOpen, setStoryDialogOpen] = useState(false);
  const { latitude, longitude } = useLocation();

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      // Use an existing table for demonstration (user_reports)
      const { data } = await supabase
        .from('user_reports')
        .select('id, reporter_id, reported_id, reason, created_at')
        .order('created_at', { ascending: false });
      // Map data to Story type (mock)
      const mappedStories = (data || []).map((s: any) => ({
        id: s.id,
        user_id: s.reporter_id,
        latitude: 0,
        longitude: 0,
        text_content: s.reason,
        image_url: undefined,
        filter_applied: undefined,
        created_at: s.created_at,
        expires_at: '',
        profiles: { first_name: 'Reporter', profile_photo_url: null },
      }));
      setStories(mappedStories);
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
      {/* Pass a mock profile to Navigation to avoid type errors */}
      <Navigation profile={{
        age: 0,
        bio: '',
        created_at: '',
        first_name: user?.user_metadata?.first_name ?? 'User',
        gender: 'prefer_not_to_say',
        ghost_mode: false,
        id: user?.id ?? '',
        interests: [],
        latitude: 0,
        location_updated_at: '',
        longitude: 0,
        profile_photo_url: user?.user_metadata?.profile_photo_url ?? '',
        updated_at: '',
        app_metadata: {},
        user_metadata: user?.user_metadata ?? {},
        aud: '',
      }} />
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
            <h1 className="text-4xl font-bold">Stories</h1>
            <Button onClick={() => setStoryDialogOpen(true)} className="gap-2">
              <PlusCircle className="h-5 w-5" />
              New Story
            </Button>
          </div>

          <div className="grid gap-6">
            {stories.map((story) => (
              <Card key={story.id} className="overflow-hidden bg-card/95 backdrop-blur-sm border-0">
                <CardContent className="p-0">
                  {story.image_url && (
                    <div className="aspect-video relative">
                      <img
                        src={story.image_url}
                        alt="Story"
                        className="w-full h-full object-cover"
                        style={{ filter: story.filter_applied }}
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        {story.profiles?.profile_photo_url ? (
                          <img
                            src={story.profiles.profile_photo_url}
                            alt={story.profiles.first_name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-lg font-semibold">
                            {story.profiles?.first_name?.[0] || '?'}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold">{story.profiles?.first_name || 'Anonymous'}</h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(story.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {story.text_content && (
                      <p className="text-lg">{story.text_content}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {stories.length === 0 && (
              <Card className="p-12 text-center bg-card/95 backdrop-blur-sm border-0">
                <p className="text-lg text-muted-foreground mb-4">No stories yet</p>
                <Button onClick={() => setStoryDialogOpen(true)}>Share Your First Story</Button>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stories;