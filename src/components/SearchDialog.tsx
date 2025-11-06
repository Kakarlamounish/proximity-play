import { useState, useEffect } from 'react';
import { Search, MapPin, Users, Image as ImageIcon, X, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface SearchFilters {
  distance?: number;
  interests?: string[];
  minMembers?: number;
  sortBy: 'distance' | 'members' | 'recent';
}

export function SearchDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('bubbles');
  const [showFilters, setShowFilters] = useState(false);
  const { user } = useAuth();

  const [filters, setFilters] = useState<SearchFilters>({
    distance: 10,
    interests: [],
    minMembers: 0,
    sortBy: 'distance',
  });

  const [bubbleResults, setBubbleResults] = useState<any[]>([]);
  const [userResults, setUserResults] = useState<any[]>([]);
  const [storyResults, setStoryResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const interestOptions = [
    'Sports', 'Music', 'Gaming', 'Food', 'Travel', 
    'Tech', 'Art', 'Fitness', 'Books', 'Movies'
  ];

  useEffect(() => {
    if (searchQuery.length >= 2) {
      performSearch();
    } else {
      setBubbleResults([]);
      setUserResults([]);
      setStoryResults([]);
    }
  }, [searchQuery, filters, activeTab]);

  const performSearch = async () => {
    if (!user) return;
    setLoading(true);

    try {
      if (activeTab === 'bubbles') {
        await searchBubbles();
      } else if (activeTab === 'users') {
        await searchUsers();
      } else if (activeTab === 'stories') {
        await searchStories();
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const searchBubbles = async () => {
    let query = supabase
      .from('bubbles')
      .select('*, creator:profiles!bubbles_creator_id_fkey(first_name, profile_photo_url)')
      .ilike('name', `%${searchQuery}%`);

    if (filters.interests && filters.interests.length > 0) {
      query = query.in('interest_tag', filters.interests);
    }

    if (filters.minMembers) {
      query = query.gte('member_count', filters.minMembers);
    }

    const { data, error } = await query.limit(20);

    if (error) throw error;
    setBubbleResults(data || []);
  };

  const searchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`first_name.ilike.%${searchQuery}%,bio.ilike.%${searchQuery}%`)
      .limit(20);

    if (error) throw error;
    setUserResults(data || []);
  };

  const searchStories = async () => {
    const { data, error } = await supabase
      .from('location_stories')
      .select('*, author:profiles!location_stories_user_id_fkey(first_name, profile_photo_url)')
      .ilike('text_content', `%${searchQuery}%`)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    setStoryResults(data || []);
  };

  const toggleInterest = (interest: string) => {
    setFilters(prev => ({
      ...prev,
      interests: prev.interests?.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...(prev.interests || []), interest],
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10">
          <Search className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Search</DialogTitle>
          <div className="flex items-center gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bubbles, users, or stories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {showFilters && activeTab === 'bubbles' && (
          <div className="px-6 py-4 bg-muted/30 border-y space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Distance: {filters.distance}km
              </label>
              <Slider
                value={[filters.distance || 10]}
                onValueChange={([value]) => setFilters(prev => ({ ...prev, distance: value }))}
                min={1}
                max={50}
                step={1}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Interests</label>
              <div className="flex flex-wrap gap-2">
                {interestOptions.map((interest) => (
                  <Badge
                    key={interest}
                    variant={filters.interests?.includes(interest) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleInterest(interest)}
                  >
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Min Members: {filters.minMembers}
              </label>
              <Slider
                value={[filters.minMembers || 0]}
                onValueChange={([value]) => setFilters(prev => ({ ...prev, minMembers: value }))}
                min={0}
                max={100}
                step={5}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Sort By</label>
              <Select
                value={filters.sortBy}
                onValueChange={(value: any) => setFilters(prev => ({ ...prev, sortBy: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="distance">Distance</SelectItem>
                  <SelectItem value="members">Members</SelectItem>
                  <SelectItem value="recent">Most Recent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="mx-6 w-fit">
            <TabsTrigger value="bubbles" className="gap-2">
              <MapPin className="h-4 w-4" />
              Bubbles
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="stories" className="gap-2">
              <ImageIcon className="h-4 w-4" />
              Stories
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-6">
            <TabsContent value="bubbles" className="mt-4 space-y-3">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Searching...</div>
              ) : bubbleResults.length === 0 && searchQuery.length >= 2 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No bubbles found
                </div>
              ) : (
                bubbleResults.map((bubble) => (
                  <div
                    key={bubble.id}
                    className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
                        {bubble.name[0]}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{bubble.name}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {bubble.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <Badge variant="secondary">{bubble.interest_tag}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {bubble.member_count} members
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="users" className="mt-4 space-y-3">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Searching...</div>
              ) : userResults.length === 0 && searchQuery.length >= 2 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No users found
                </div>
              ) : (
                userResults.map((profile) => (
                  <div
                    key={profile.id}
                    className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={profile.profile_photo_url || '/placeholder.svg'}
                        alt={profile.first_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold">{profile.first_name}</h3>
                        {profile.bio && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {profile.bio}
                          </p>
                        )}
                        {profile.interests && profile.interests.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {profile.interests.slice(0, 3).map((interest: string) => (
                              <Badge key={interest} variant="outline" className="text-xs">
                                {interest}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="stories" className="mt-4 space-y-3">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Searching...</div>
              ) : storyResults.length === 0 && searchQuery.length >= 2 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No stories found
                </div>
              ) : (
                storyResults.map((story) => (
                  <div
                    key={story.id}
                    className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex gap-3">
                      {story.image_url && (
                        <img
                          src={story.image_url}
                          alt="Story"
                          className="w-20 h-20 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <img
                            src={story.author?.profile_photo_url || '/placeholder.svg'}
                            alt={story.author?.first_name}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                          <span className="text-sm font-medium">
                            {story.author?.first_name}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-2">{story.text_content}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
