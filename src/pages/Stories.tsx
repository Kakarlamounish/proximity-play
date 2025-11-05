import React, { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import CreateStoryDialog from '@/components/CreateStoryDialog';
import { StoryCard } from '@/components/StoryCard';
import { useLocation } from '@/hooks/useLocation';
import { StorySkeleton, PageSkeleton } from '@/components/ui/skeleton-loader';

const Stories = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storyDialogOpen, setStoryDialogOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [storyReactions, setStoryReactions] = useState<{[key: string]: any[]}>({});
  const [userReactions, setUserReactions] = useState<{[key: string]: string}>({});
  const [storyViews, setStoryViews] = useState<{[key: string]: number}>({});
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
      // Get current location for filtering nearby stories
      const currentLocation = { latitude, longitude };

      let query = supabase
        .from('location_stories')
        .select('*')
        .order('created_at', { ascending: false });

      // If we have location, filter by visibility radius
      if (currentLocation.latitude && currentLocation.longitude) {
        // For now, fetch all and filter client-side (can be optimized with PostGIS later)
        query = query.limit(50);
      }

      const { data } = await query;

      if (data) {
        // Filter expired stories
        const now = new Date();
        const activeStories = data.filter(story => new Date(story.expires_at) > now);

        // Filter by distance if location available
        let filteredStories = activeStories;
        if (currentLocation.latitude && currentLocation.longitude) {
          filteredStories = activeStories.filter(story => {
            const distance = calculateDistance(
              currentLocation.latitude,
              currentLocation.longitude,
              story.latitude,
              story.longitude
            );
            return distance <= story.visibility_radius / 1000; // Convert meters to km
          });
        }

        // Fetch profiles for all story creators
        const userIds = [...new Set(filteredStories.map(s => s.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, profile_photo_url')
          .in('id', userIds);

        const storiesWithProfiles = filteredStories.map(story => ({
          id: story.id,
          created_at: story.created_at,
          expires_at: story.expires_at,
          description: story.text_content || 'Location story',
          user_id: story.user_id,
          profiles: profilesData?.find(p => p.id === story.user_id),
          image_url: story.image_url,
          latitude: story.latitude,
          longitude: story.longitude,
          visibility_radius: story.visibility_radius
        }));

        setStories(storiesWithProfiles);
      }
    } catch (error) {
      console.error('Error fetching stories:', error);
    } finally {
      setLoading(false);
    }
  }

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  useEffect(() => {
    fetchStories();
    fetchProfile();
  }, [user, latitude, longitude]);

  useEffect(() => {
    if (stories.length > 0) {
      fetchReactions();
      fetchViews();
    }
  }, [stories, user]);

  const fetchReactions = async () => {
    if (!user || stories.length === 0) return;

    try {
      // Fetch reactions for all visible stories
      const { data: reactions } = await supabase
        .from('story_reactions')
        .select('*')
        .in('story_id', stories.map(s => s.id));

      // Group reactions by story_id
      const reactionsByStory: {[key: string]: any[]} = {};
      reactions?.forEach(reaction => {
        if (!reactionsByStory[reaction.story_id]) {
          reactionsByStory[reaction.story_id] = [];
        }
        reactionsByStory[reaction.story_id].push(reaction);
      });

      setStoryReactions(reactionsByStory);

      // Check user's reactions
      const userReactionMap: {[key: string]: string} = {};
      reactions?.filter(r => r.user_id === user.id).forEach(reaction => {
        userReactionMap[reaction.story_id] = reaction.reaction_type;
      });

      setUserReactions(userReactionMap);
    } catch (error) {
      console.error('Error fetching reactions:', error);
    }
  };

  const fetchViews = async () => {
    if (stories.length === 0) return;

    try {
      // Fetch view counts for all visible stories
      const { data: views } = await supabase
        .from('story_views')
        .select('story_id')
        .in('story_id', stories.map(s => s.id));

      // Count views by story_id
      const viewsByStory: {[key: string]: number} = {};
      views?.forEach(view => {
        viewsByStory[view.story_id] = (viewsByStory[view.story_id] || 0) + 1;
      });

      setStoryViews(viewsByStory);

      // Record views for current user (if not already viewed)
      if (user) {
        const viewedStories = views?.filter(v => v.viewer_id === user.id).map(v => v.story_id) || [];
        const unviewedStories = stories.filter(s => !viewedStories.includes(s.id));

        for (const story of unviewedStories) {
          await supabase
            .from('story_views')
            .insert({
              story_id: story.id,
              viewer_id: user.id
            });
        }

        // Refresh view counts after recording new views
        if (unviewedStories.length > 0) {
          const { data: updatedViews } = await supabase
            .from('story_views')
            .select('story_id')
            .in('story_id', stories.map(s => s.id));

          const updatedViewsByStory: {[key: string]: number} = {};
          updatedViews?.forEach(view => {
            updatedViewsByStory[view.story_id] = (updatedViewsByStory[view.story_id] || 0) + 1;
          });

          setStoryViews(updatedViewsByStory);
        }
      }
    } catch (error) {
      console.error('Error fetching views:', error);
    }
  };

  const handleReaction = async (storyId: string, reactionType: string) => {
    if (!user) return;

    try {
      const existingReaction = userReactions[storyId];

      if (existingReaction === reactionType) {
        // Remove reaction
        await supabase
          .from('story_reactions')
          .delete()
          .eq('story_id', storyId)
          .eq('user_id', user.id);

        setUserReactions(prev => {
          const newState = { ...prev };
          delete newState[storyId];
          return newState;
        });
      } else {
        // Add or update reaction
        await supabase
          .from('story_reactions')
          .upsert({
            story_id: storyId,
            user_id: user.id,
            reaction_type: reactionType
          });

        setUserReactions(prev => ({
          ...prev,
          [storyId]: reactionType
        }));
      }

      // Refresh reactions
      fetchReactions();
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  };

  if (loading) {
    return <PageSkeleton />;
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
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Nearby Stories</h2>
            <Button onClick={() => setStoryDialogOpen(true)} className="gap-2 bg-gradient-to-r from-secondary to-primary">
              <PlusCircle className="h-5 w-5" />
              Share Story
            </Button>
          </div>

          {stories.length > 0 ? (
            <div className="stories-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stories.map((story) => {
                const isExpired = new Date(story.expires_at) < new Date();
                return (
                  <div key={story.id} className={`stories-card backdrop-blur-sm bg-card/95 border-0 rounded-xl p-6 ${isExpired ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <img
                        src={story.profiles?.profile_photo_url || '/avatar-placeholder.png'}
                        alt={story.profiles?.first_name || 'User'}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{story.profiles?.first_name || 'Anonymous'}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(story.created_at).toLocaleDateString()}
                          {isExpired && <span className="text-destructive ml-2">• Expired</span>}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`text-sm ${userReactions[story.id] === 'like' ? 'text-red-400' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => handleReaction(story.id, 'like')}
                        >
                          👍 {storyReactions[story.id]?.filter(r => r.reaction_type === 'like').length || 0}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`text-sm ${userReactions[story.id] === 'love' ? 'text-pink-400' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => handleReaction(story.id, 'love')}
                        >
                          ❤️ {storyReactions[story.id]?.filter(r => r.reaction_type === 'love').length || 0}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`text-sm ${userReactions[story.id] === 'laugh' ? 'text-yellow-400' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => handleReaction(story.id, 'laugh')}
                        >
                          😂 {storyReactions[story.id]?.filter(r => r.reaction_type === 'laugh').length || 0}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm">
                          👀 {storyViews[story.id] || 0}
                        </Button>
                      </div>
                    </div>
                    {story.image_url && (
                      <img
                        src={story.image_url}
                        alt="Story"
                        className="w-full h-48 object-cover rounded-lg mb-4"
                      />
                    )}
                    <p className="mb-3">{story.description}</p>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      {(story.latitude || story.longitude) && (
                        <span>📍 {story.latitude?.toFixed(4)}, {story.longitude?.toFixed(4)}</span>
                      )}
                      <span>👁️ {storyViews[story.id] || 0} views</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="stories-card backdrop-blur-sm bg-card/95 border-0 rounded-xl p-12">
              <div className="text-center">
                <div className="text-6xl mb-4">📱</div>
                <h3 className="text-xl font-semibold mb-2">No stories nearby</h3>
                <p className="text-muted-foreground mb-6">Be the first to share a location-based story!</p>
                <Button onClick={() => setStoryDialogOpen(true)} className="gap-2 bg-gradient-to-r from-secondary to-primary">
                  <PlusCircle className="h-5 w-5" />
                  Create Your First Story
                </Button>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
};

export default Stories;
