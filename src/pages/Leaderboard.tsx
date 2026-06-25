import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Flame, Ghost, ChevronLeft, Award, Send, ArrowDown, BookOpen } from 'lucide-react';
import { Navigation } from '@/components/Navigation';

interface ScoreRow {
  user_id: string;
  snaps_sent: number;
  snaps_received: number;
  stories_posted: number;
  total_score: number;
  profile?: { first_name: string | null; profile_photo_url: string | null };
}

interface StreakRow {
  id: string;
  user_id_1: string;
  user_id_2: string;
  streak_count: number;
  last_snap_at: string;
  partner?: { id: string; first_name: string | null; profile_photo_url: string | null };
}

interface BadgeRow {
  badge_id: string;
  earned_at: string;
  badge: { name: string; icon: string | null; description: string | null } | null;
}

const medal = (rank: number) =>
  rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `#${rank + 1}`;

const Leaderboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [global, setGlobal] = useState<ScoreRow[]>([]);
  const [friends, setFriends] = useState<ScoreRow[]>([]);
  const [streaks, setStreaks] = useState<StreakRow[]>([]);
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [myScore, setMyScore] = useState<ScoreRow | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      setBusy(true);

      // 1. Global top 50 scores + profile join
      const { data: scores } = await supabase
        .from('snap_scores')
        .select('user_id, snaps_sent, snaps_received, stories_posted, total_score')
        .order('total_score', { ascending: false })
        .limit(50);

      const ids = Array.from(new Set((scores ?? []).map((s: any) => s.user_id)));
      const { data: profs } = ids.length
        ? await supabase.from('profiles').select('id, first_name, profile_photo_url').in('id', ids)
        : { data: [] as any[] };
      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      const decorated: ScoreRow[] = (scores ?? []).map((s: any) => ({
        ...s,
        profile: profMap.get(s.user_id),
      }));
      if (cancelled) return;
      setGlobal(decorated);
      setMyScore(decorated.find((s) => s.user_id === user.id) ?? null);

      // 2. Friends-only leaderboard
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_id_1, user_id_2')
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);
      const friendIds = (friendships ?? [])
        .map((f: any) => (f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1));
      const includeIds = [user.id, ...friendIds];
      const friendList = decorated.filter((s) => includeIds.includes(s.user_id));
      // also pull scores for friends not already in top 50
      const missing = includeIds.filter((id) => !friendList.some((s) => s.user_id === id));
      if (missing.length) {
        const { data: extra } = await supabase
          .from('snap_scores')
          .select('user_id, snaps_sent, snaps_received, stories_posted, total_score')
          .in('user_id', missing);
        (extra ?? []).forEach((s: any) => {
          friendList.push({ ...s, profile: profMap.get(s.user_id) });
        });
      }
      friendList.sort((a, b) => b.total_score - a.total_score);
      if (cancelled) return;
      setFriends(friendList);

      // 3. My streaks
      const { data: streakRows } = await supabase
        .from('snap_streaks')
        .select('id, user_id_1, user_id_2, streak_count, last_snap_at')
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
        .order('streak_count', { ascending: false });
      const partnerIds = (streakRows ?? [])
        .map((r: any) => (r.user_id_1 === user.id ? r.user_id_2 : r.user_id_1));
      const { data: partners } = partnerIds.length
        ? await supabase.from('profiles').select('id, first_name, profile_photo_url').in('id', partnerIds)
        : { data: [] as any[] };
      const pMap = new Map((partners ?? []).map((p: any) => [p.id, p]));
      const streakDecorated: StreakRow[] = (streakRows ?? []).map((r: any) => ({
        ...r,
        partner: pMap.get(r.user_id_1 === user.id ? r.user_id_2 : r.user_id_1),
      }));
      if (cancelled) return;
      setStreaks(streakDecorated);

      // 4. My badges
      const { data: myBadges } = await supabase
        .from('user_badges')
        .select('badge_id, earned_at, badge:badges(name, icon, description)')
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false });
      if (cancelled) return;
      setBadges((myBadges ?? []) as any);

      setBusy(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user && !loading) return <Navigate to="/auth" replace />;

  const myRank = global.findIndex((s) => s.user_id === user?.id);

  const renderRow = (row: ScoreRow, rank: number) => {
    const isMe = row.user_id === user?.id;
    return (
      <div
        key={row.user_id}
        className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
          isMe ? 'bg-primary/10 border-primary/40' : 'bg-card border-border hover:bg-accent/40'
        }`}
      >
        <div className="w-10 text-center text-lg font-extrabold text-muted-foreground">
          {medal(rank)}
        </div>
        <Avatar className="h-10 w-10">
          <AvatarImage src={row.profile?.profile_photo_url ?? undefined} />
          <AvatarFallback>{row.profile?.first_name?.[0] ?? '?'}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">
            {row.profile?.first_name ?? 'Anonymous'} {isMe && <span className="text-xs text-primary">(you)</span>}
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Send className="h-3 w-3" /> {row.snaps_sent}</span>
            <span className="flex items-center gap-1"><ArrowDown className="h-3 w-3" /> {row.snaps_received}</span>
            <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {row.stories_posted}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 font-extrabold text-primary">
          <Ghost className="h-4 w-4" />
          {row.total_score.toLocaleString()}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Trophy className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-extrabold">Leaderboard</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* My summary card */}
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex flex-col items-center">
              <span className="text-3xl">{myRank >= 0 ? medal(myRank) : '—'}</span>
              <span className="text-xs text-muted-foreground">Global</span>
            </div>
            <div className="flex-1">
              <div className="text-sm text-muted-foreground">Your Snap Score</div>
              <div className="text-3xl font-extrabold text-primary flex items-center gap-2">
                <Ghost className="h-6 w-6" />
                {(myScore?.total_score ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold flex items-center gap-1 justify-end text-orange-500">
                <Flame className="h-5 w-5" />
                {streaks.reduce((max, s) => Math.max(max, s.streak_count), 0)}
              </div>
              <div className="text-xs text-muted-foreground">Best streak</div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="global" className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="global">Global</TabsTrigger>
            <TabsTrigger value="friends">Friends</TabsTrigger>
            <TabsTrigger value="streaks">Streaks</TabsTrigger>
            <TabsTrigger value="badges">Badges</TabsTrigger>
          </TabsList>

          <TabsContent value="global" className="space-y-2 mt-3">
            {busy ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
            ) : global.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No scores yet — start snapping!</p>
            ) : (
              global.map((s, i) => renderRow(s, i))
            )}
          </TabsContent>

          <TabsContent value="friends" className="space-y-2 mt-3">
            {friends.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Add friends to see how you stack up.</p>
            ) : (
              friends.map((s, i) => renderRow(s, i))
            )}
          </TabsContent>

          <TabsContent value="streaks" className="space-y-2 mt-3">
            {streaks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No active streaks. Send snaps daily with the same friend to start one!
              </p>
            ) : (
              streaks.map((s) => {
                const hoursLeft = 24 - (Date.now() - new Date(s.last_snap_at).getTime()) / 3600000;
                const expiring = hoursLeft < 4;
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={s.partner?.profile_photo_url ?? undefined} />
                      <AvatarFallback>{s.partner?.first_name?.[0] ?? '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-semibold">{s.partner?.first_name ?? 'Friend'}</div>
                      <div className="text-xs text-muted-foreground">
                        {expiring ? `Expires in ${Math.max(0, Math.round(hoursLeft))}h` : 'Active'}
                      </div>
                    </div>
                    <Badge
                      className={`gap-1 font-bold ${
                        expiring ? 'bg-destructive/20 text-destructive animate-pulse' : 'bg-orange-500/20 text-orange-500'
                      }`}
                      variant="secondary"
                    >
                      <Flame className="h-4 w-4" />
                      {s.streak_count}
                    </Badge>
                  </div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="badges" className="mt-3">
            {badges.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Explore the map and join bubbles to earn badges.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {badges.map((b) => (
                  <Card key={b.badge_id} className="bg-gradient-to-br from-primary/10 to-transparent">
                    <CardContent className="p-3 flex flex-col items-center gap-1 text-center">
                      <div className="text-3xl">{b.badge?.icon ?? '🏆'}</div>
                      <div className="font-bold text-sm">{b.badge?.name ?? 'Badge'}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-2">
                        {b.badge?.description}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(b.earned_at).toLocaleDateString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Navigation />
    </div>
  );
};

export default Leaderboard;
