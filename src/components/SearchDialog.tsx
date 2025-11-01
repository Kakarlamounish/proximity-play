import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Users, MessageCircle, MapPin, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

import type { Database } from '@/integrations/supabase/types';

type ProfilesRow = Database['public']['Tables']['profiles']['Row'];
type BubblesRow = Database['public']['Tables']['bubbles']['Row'];
type MeetupsRow = Database['public']['Tables']['meetups']['Row'];

interface SearchResult {
  id: string;
  type: 'user' | 'bubble' | 'meetup';
  title: string;
  subtitle?: string;
  avatar?: string;
  badge?: string;
  location?: string;
  memberCount?: number;
  distance?: number;
  metadata?: ProfilesRow | BubblesRow | MeetupsRow;
}

interface SearchDialogProps {
  trigger?: React.ReactNode;
}

export const SearchDialog: React.FC<SearchDialogProps> = ({ trigger }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeTab, setActiveTab] = useState('all');

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !user) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const searchResults: SearchResult[] = [];

      // Search users
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, first_name, profile_photo_url, interests, bio')
        .neq('id', user.id)
        .or(`first_name.ilike.%${searchQuery}%,bio.ilike.%${searchQuery}%`)
        .limit(10);

      usersData?.forEach(userData => {
        searchResults.push({
          id: `user-${userData.id}`,
          type: 'user',
          title: userData.first_name,
          subtitle: userData.bio || 'No bio available',
          avatar: userData.profile_photo_url,
          badge: userData.interests?.[0] || 'User'
        });
      });

      // Search bubbles
      const { data: bubblesData } = await supabase
        .from('bubbles')
        .select('id, name, interest_tag, member_count, latitude, longitude')
        .or(`name.ilike.%${searchQuery}%,interest_tag.ilike.%${searchQuery}%`)
        .limit(10);

      bubblesData?.forEach(bubbleData => {
        searchResults.push({
          id: `bubble-${bubbleData.id}`,
          type: 'bubble',
          title: bubbleData.name,
          subtitle: `A ${bubbleData.interest_tag} community`,
          badge: bubbleData.interest_tag,
          memberCount: bubbleData.member_count || 0
        });
      });

      // Search meetups
      const { data: meetupsData } = await supabase
        .from('meetups')
        .select('id, title, description, date_time, location_name')
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,location_name.ilike.%${searchQuery}%`)
        .gte('date_time', new Date().toISOString())
        .limit(10);

      if (meetupsData && meetupsData.length > 0) {
        // Get bubble info for meetups
        const meetupIds = meetupsData.map(m => m.id);
        const { data: meetupBubbles } = await supabase
          .from('meetups')
          .select('id, bubble_id, bubbles(name, interest_tag)')
          .in('id', meetupIds);

        const bubbleMap = new Map(meetupBubbles?.map(mb => [mb.id, mb.bubbles]) || []);

        meetupsData.forEach(meetupData => {
          const bubble = bubbleMap.get(meetupData.id) as any;
          searchResults.push({
            id: `meetup-${meetupData.id}`,
            type: 'meetup',
            title: meetupData.title,
            subtitle: meetupData.description || 'No description',
            location: meetupData.location_name || undefined,
            badge: bubble?.interest_tag || 'Meetup'
          });
        });
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Search failed',
        description: 'There was an error searching. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, performSearch]);

  const handleResultClick = async (result: SearchResult) => {
    switch (result.type) {
      case 'user':
        // TODO: Navigate to user profile or send message
        toast({
          title: 'User selected',
          description: `Selected ${result.title}`
        });
        break;
        
      case 'bubble':
        try {
          // Check if user is already a member
          const bubbleId = result.id.replace('bubble-', '');
          const { data: membership } = await supabase
            .from('bubble_memberships')
            .select('id')
            .eq('user_id', user!.id)
            .eq('bubble_id', bubbleId)
            .maybeSingle();

          if (membership) {
            // Already a member, go to chat
            navigate('/messages', { state: { selectedBubbleId: bubbleId } });
          } else {
            // Not a member, show join option
            toast({
              title: 'Join bubble?',
              description: `Do you want to join ${result.title}?`
            });
          }
        } catch (error) {
          console.error('Error checking membership:', error);
        }
        break;
        
      case 'meetup':
        toast({
          title: 'Meetup selected',
          description: `Selected ${result.title}`
        });
        break;
    }
    setOpen(false);
  };

  const getFilteredResults = () => {
    if (activeTab === 'all') return results;
    return results.filter(result => result.type === activeTab);
  };

  const getResultIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'user':
        return <Users className="h-4 w-4" />;
      case 'bubble':
        return <MessageCircle className="h-4 w-4" />;
      case 'meetup':
        return <Calendar className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="w-full justify-start text-muted-foreground">
            <Search className="h-4 w-4 mr-2" />
            Search users, bubbles, meetups...
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Search</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for users, bubbles, or meetups..."
              className="pl-9"
              autoFocus
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="user">Users</TabsTrigger>
              <TabsTrigger value="bubble">Bubbles</TabsTrigger>
              <TabsTrigger value="meetup">Meetups</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="flex-1 overflow-y-auto">
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse flex items-start gap-3 p-3">
                        <div className="h-10 w-10 bg-muted rounded-full" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-3/4" />
                          <div className="h-3 bg-muted rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : getFilteredResults().length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {query ? (
                      <>
                        <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No results found for "{query}"</p>
                        <p className="text-sm">Try different keywords</p>
                      </>
                    ) : (
                      <>
                        <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Start typing to search</p>
                      </>
                    )}
                  </div>
                ) : (
                  getFilteredResults().map((result) => (
                    <div
                      key={result.id}
                      onClick={() => handleResultClick(result)}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={result.avatar} />
                        <AvatarFallback className="bg-gradient-to-br from-secondary to-primary text-white">
                          {result.type === 'user' 
                            ? result.title[0]?.toUpperCase() 
                            : result.badge?.[0]?.toUpperCase() || '?'
                          }
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {getResultIcon(result.type)}
                          <h4 className="font-medium truncate">{result.title}</h4>
                          {result.badge && (
                            <Badge variant="secondary" className="text-xs">
                              {result.badge}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-muted-foreground truncate">
                          {result.subtitle}
                        </p>
                        
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {result.memberCount && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {result.memberCount}
                            </span>
                          )}
                          {result.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {result.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};