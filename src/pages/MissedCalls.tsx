import React, { useState, useCallback, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, PhoneMissed, Search, CheckCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, isToday, isThisWeek } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type MissedNotification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  data: any;
};

type Profile = { id: string; first_name: string; profile_photo_url: string | null };
type Bubble = { id: string; name: string };

const MissedCalls = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all');

  const { data: rawItems = [], isLoading } = useQuery({
    queryKey: ['missed-calls', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id, title, body, read, created_at, data')
        .eq('user_id', user!.id)
        .eq('type', 'missed_call')
        .order('created_at', { ascending: false })
        .limit(100);
      return (data || []) as MissedNotification[];
    },
  });

  const { data: profiles = {} } = useQuery({
    queryKey: ['missed-calls-profiles', rawItems.map(i => i.data?.callerId).join()],
    enabled: rawItems.length > 0,
    queryFn: async () => {
      const ids = [...new Set(rawItems.map(i => i.data?.callerId).filter(Boolean))] as string[];
      if (!ids.length) return {};
      const { data } = await supabase.from('profiles').select('id, first_name, profile_photo_url').in('id', ids);
      const map: Record<string, Profile> = {};
      data?.forEach(p => (map[p.id] = p as Profile));
      return map;
    },
  });

  const { data: bubbles = {} } = useQuery({
    queryKey: ['missed-calls-bubbles', rawItems.map(i => i.data?.bubbleId).join()],
    enabled: rawItems.length > 0,
    queryFn: async () => {
      const ids = [...new Set(rawItems.map(i => i.data?.bubbleId).filter(Boolean))] as string[];
      if (!ids.length) return {};
      const { data } = await supabase.from('bubbles').select('id, name').in('id', ids);
      const map: Record<string, Bubble> = {};
      data?.forEach(b => (map[b.id] = b as Bubble));
      return map;
    },
  });

  const filtered = useMemo(() => {
    return rawItems.filter(n => {
      const d = new Date(n.created_at);
      if (filter === 'today' && !isToday(d)) return false;
      if (filter === 'week' && !isThisWeek(d)) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const caller = n.data?.callerId ? profiles[n.data.callerId] : undefined;
        const bubble = n.data?.bubbleId ? bubbles[n.data.bubbleId] : undefined;
        const name = bubble?.name || caller?.first_name || '';
        if (!name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rawItems, filter, search, profiles, bubbles]);

  const bulkMark = useMutation({
    mutationFn: async () => {
      const unreadIds = filtered.filter(i => !i.read).map(i => i.id);
      if (!unreadIds.length) return;
      await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missed-calls'] });
      toast({ title: 'Done', description: 'All visible missed calls marked as seen.' });
    },
  });

  const markOne = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['missed-calls'] });
  };

  const handleCallBack = (callerId?: string, bubbleId?: string, callType: 'audio' | 'video' = 'audio') => {
    const target = bubbleId || callerId;
    if (!target) return;
    window.location.href = `/calls`;
  };

  if (!user && !loading) return <Navigate to="/auth" replace />;

  const unreadCount = filtered.filter(i => !i.read).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-primary">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <PhoneMissed className="h-7 w-7 text-destructive" />
              Missed Calls
            </h1>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={() => bulkMark.mutate()} disabled={bulkMark.isPending}>
                <CheckCheck className="h-4 w-4 mr-2" />
                Mark all seen ({unreadCount})
              </Button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by caller or bubble…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Tabs value={filter} onValueChange={v => setFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">This week</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Card className="backdrop-blur-sm bg-card/95 border-0">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No missed calls found.</div>
              ) : (
                <div className="divide-y divide-border">
                  {filtered.map(n => {
                    const callType = (n.data?.callType as 'audio' | 'video') || 'audio';
                    const callerId = n.data?.callerId as string | undefined;
                    const bubbleId = n.data?.bubbleId as string | undefined;
                    const caller = callerId ? profiles[callerId] : undefined;
                    const bubble = bubbleId ? bubbles[bubbleId] : undefined;
                    const title = bubble ? `${bubble.name} (bubble)` : (caller?.first_name || 'Unknown');

                    return (
                      <div key={n.id} className={`flex items-center gap-3 p-4 ${!n.read ? 'bg-primary/5' : ''}`}>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={caller?.profile_photo_url || undefined} />
                          <AvatarFallback>{(caller?.first_name?.[0] || '?').toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{title}</p>
                          <p className="text-xs text-muted-foreground">
                            {callType} • {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!n.read && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markOne(n.id)}>
                              Seen
                            </Button>
                          )}
                          <Button size="sm" onClick={() => { markOne(n.id); handleCallBack(callerId, bubbleId, callType); }}>
                            <Phone className="h-4 w-4 mr-1" />
                            Call back
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MissedCalls;
