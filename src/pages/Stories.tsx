import React, { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Loader2, Map, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import CreateStoryDialog from '@/components/CreateStoryDialog';
import { StoryCard } from '@/components/StoryCard';
import { useLocation } from '@/hooks/useLocation';
import { StorySkeleton, PageSkeleton } from '@/components/ui/skeleton-loader';
import { EmptyState } from '@/components/EmptyState';
import { StoryRing } from '@/components/StoryRing';
import { useSnapScore } from '@/hooks/useSnapScore';
import { useToast } from '@/hooks/use-toast';

interface StoryProfile {
  id: string;
  first_name: string | null;
  profile_photo_url: string | null;
}

interface Story {
  id: string;
  created_at: string;
  expires_at: string;
  description: string;
  user_id: string;
  profiles?: StoryProfile;
  image_url?: string | null;
  latitude?: number;
  longitude?: number;
  visibility_radius?: number;
}

interface FriendStoryCreator {
  id: string;
  first_name: string;
  profile_photo_url: string | null;
  hasUnwatched: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function expiresIn(dateStr: string): string {
  const ms = new Date(dateStr).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

const Stories = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stories, setStories] = useState<Story[]>([]);
  // BUG-020: expiry was only ever evaluated at fetch time — a story that
  // expired while the page stayed open remained reactable/viewable (only its
  // countdown badge text went stale) until the next manual refetch. Re-check
  // every 30s and drop expired ones from the rendered grid client-side.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);
  const visibleStories = stories.filter(s => new Date(s.expires_at).getTime() > nowTick);
  const [loading, setLoading] = useState(true);
  const [storyDialogOpen, setStoryDialogOpen] = useState(false);
  const [profile, setProfile] = useState<StoryProfile | null>(null);
  const [storyReactions, setStoryReactions] = useState<{[key: string]: {reaction_type: string; user_id: string}[]}>({});
  const [userReactions, setUserReactions] = useState<{[key: string]: string}>({});
  const [storyViews, setStoryViews] = useState<{[key: string]: number}>({});
  const [friendStoryCreators, setFriendStoryCreators] = useState<FriendStoryCreator[]>([]);
  const { latitude, longitude } = useLocation();
  const { incrementScore } = useSnapScore();

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

  const fetchFriendStoryCreators = async () => {
    if (!user) return;
    try {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_id_1, user_id_2')
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);
      const friendIds = friendships?.map(f => f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1) || [];
      if (friendIds.length === 0) return;

      const { data: friendStories } = await supabase
        .from('location_stories')
        .select('id, user_id')
        .in('user_id', friendIds)
        .gt('expires_at', new Date().toISOString());

      const creatorIds = [...new Set(friendStories?.map(s => s.user_id) || [])];
      if (creatorIds.length === 0) {
        setFriendStoryCreators([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, profile_photo_url')
        .in('id', creatorIds);

      // BUG-019: hasUnwatched was hardcoded `true` — the ring never turned
      // off even after the user had seen every story. Derive it from the
      // same story_views rows the "Nearby Stories" grid already records.
      const allStoryIds = (friendStories || []).map(s => s.id);
      let viewedStoryIds = new Set<string>();
      if (allStoryIds.length > 0) {
        const { data: myViews } = await supabase
          .from('story_views')
          .select('story_id')
          .eq('viewer_id', user.id)
          .in('story_id', allStoryIds);
        viewedStoryIds = new Set((myViews || []).map(v => v.story_id));
      }

      setFriendStoryCreators(
        (profiles || []).map(p => ({
          id: p.id,
          first_name: p.first_name,
          profile_photo_url: p.profile_photo_url,
          hasUnwatched: (friendStories || []).some(s => s.user_id === p.id && !viewedStoryIds.has(s.id)),
        }))
      );
    } catch (err) {
      console.error('Error fetching friend story creators:', err);
    }
  };

  useEffect(() => {
    fetchStories();
    fetchProfile();
    fetchFriendStoryCreators();
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

        let recordedNew = false;
        for (const story of unviewedStories) {
          const { error } = await supabase
            .from('story_views')
            .insert({
              story_id: story.id,
              viewer_id: user.id
            });
          if (!error) {
            recordedNew = true;
          } else {
            console.error(`Error recording view for story ${story.id}:`, error.message);
          }
        }

        // Refresh view counts after recording new views
        if (recordedNew) {
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
        const { error } = await supabase
          .from('story_reactions')
          .delete()
          .eq('story_id', storyId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error deleting reaction:', error);
          toast({ title: `Failed to remove reaction: ${error.message}`, variant: 'destructive' });
          return;
        }

        setUserReactions(prev => {
          const newState = { ...prev };
          delete newState[storyId];
          return newState;
        });
      } else {
        // Add or update reaction
        const { error } = await supabase
          .from('story_reactions')
          .upsert({
            story_id: storyId,
            user_id: user.id,
            reaction_type: reactionType
          });

        if (error) {
          console.error('Error upserting reaction:', error);
          toast({ title: `Failed to save reaction: ${error.message}`, variant: 'destructive' });
          return;
        }

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

  // BUG-019: clicking a friend's story ring did nothing — no dedicated
  // tap-through story viewer exists (stories render as an inline grid, not a
  // modal), so building one is out of scope for a fix pass. This is the
  // lightweight interaction that scope allows: jump to and highlight that
  // creator's card in the grid below, since it's the same data already
  // rendered on this page.
  const handleStoryRingClick = (creatorId: string) => {
    const target = stories.find(s => s.user_id === creatorId);
    if (!target) {
      toast({ title: "This friend's story isn't visible from your current location right now." });
      return;
    }
    const el = document.getElementById(`story-card-${target.id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-primary');
    setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 1500);
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
      <main className="page-stories px-4 sm:px-8 py-8 pb-20 md:pb-8">
        <header className="mb-6">
          <h1 className="text-4xl font-bold">Stories</h1>
        </header>

        {/* Story Rings - Snapchat style horizontal scroll */}
        {friendStoryCreators.length > 0 && (
          <div className="mb-6 overflow-x-auto hide-scrollbar">
            <div className="flex gap-4 min-w-min px-1 py-2">
              {/* Your story (add) */}
              <button
                onClick={() => setStoryDialogOpen(true)}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary flex items-center justify-center bg-muted">
                  <PlusCircle className="h-6 w-6 text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Your Story</span>
              </button>
              {friendStoryCreators.map(creator => (
                <StoryRing
                  key={creator.id}
                  name={creator.first_name}
                  avatarUrl={creator.profile_photo_url}
                  hasUnwatched={creator.hasUnwatched}
                  onClick={() => handleStoryRingClick(creator.id)}
                />
              ))}
            </div>
          </div>
        )}

        <section className="stories-content">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Nearby Stories</h2>
            <Button onClick={() => setStoryDialogOpen(true)} className="gap-2 bg-gradient-to-r from-secondary to-primary">
              <PlusCircle className="h-5 w-5" />
              Share Story
            </Button>
          </div>

          {visibleStories.length > 0 ? (
            <div className="stories-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleStories.map((story: Story) => {
                const isExpired = new Date(story.expires_at) < new Date();
                return (
                  <div key={story.id} id={`story-card-${story.id}`} className={`stories-card backdrop-blur-sm bg-card/95 border-0 rounded-xl p-6 transition-shadow ${isExpired ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-3 mb-4">
                        <img
                          src={story.profiles?.profile_photo_url || '/avatar-placeholder.png'}
                          alt={story.profiles?.first_name || 'User'}
                          className="w-10 h-10 rounded-full object-cover border-2 border-border"
                        />
                        <div className="flex-1">
                          <p className="font-semibold">{story.profiles?.first_name || 'Anonymous'}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-muted-foreground">{timeAgo(story.created_at)}</p>
                            <Badge
                              variant={new Date(story.expires_at) < new Date() ? 'destructive' : 'secondary'}
                              className="text-[10px] py-0 h-4 gap-0.5"
                            >
                              <Clock className="h-2.5 w-2.5" />
                              {expiresIn(story.expires_at)}
                            </Badge>
                          </div>
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
                          💖 {storyReactions[story.id]?.filter(r => r.reaction_type === 'love').length || 0}
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
            <EmptyState
              icon={Map}
              title="No Stories Nearby"
              description="Be the first to share a location-based story in your area! Stories help you connect with your community."
              actionLabel="Create Your First Story"
              onAction={() => setStoryDialogOpen(true)}
            />
          )}
        </section>
      </main>
    </>
  );
};

export default Stories;
