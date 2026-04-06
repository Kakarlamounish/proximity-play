import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SnapStreak {
  id: string;
  friend_id: string;
  friend_name?: string;
  friend_avatar?: string;
  streak_count: number;
  last_snap_at: string;
  last_snap_by: string | null;
  started_at: string;
  is_expiring: boolean; // true if <4 hours left
}

export function useSnapStreaks() {
  const { user } = useAuth();
  const [streaks, setStreaks] = useState<SnapStreak[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStreaks = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('snap_streaks')
        .select('*')
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
        .order('streak_count', { ascending: false });

      if (!data || data.length === 0) { setStreaks([]); setLoading(false); return; }

      const friendIds = data.map(s => s.user_id_1 === user.id ? s.user_id_2 : s.user_id_1);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, profile_photo_url')
        .in('id', friendIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const now = Date.now();

      const mapped: SnapStreak[] = data.map(s => {
        const friendId = s.user_id_1 === user.id ? s.user_id_2 : s.user_id_1;
        const profile = profileMap.get(friendId);
        const hoursSinceLastSnap = (now - new Date(s.last_snap_at).getTime()) / (1000 * 60 * 60);
        return {
          id: s.id,
          friend_id: friendId,
          friend_name: profile?.first_name || 'Unknown',
          friend_avatar: profile?.profile_photo_url || undefined,
          streak_count: s.streak_count,
          last_snap_at: s.last_snap_at,
          last_snap_by: s.last_snap_by,
          started_at: s.started_at,
          is_expiring: hoursSinceLastSnap >= 20, // expires at 24h, warn at 20h
        };
      });

      setStreaks(mapped);
    } catch (err) {
      console.error('Error fetching streaks:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateStreak = useCallback(async (friendId: string) => {
    if (!user) return;
    const id1 = user.id < friendId ? user.id : friendId;
    const id2 = user.id < friendId ? friendId : user.id;

    const { data: existing } = await supabase
      .from('snap_streaks')
      .select('*')
      .eq('user_id_1', id1)
      .eq('user_id_2', id2)
      .maybeSingle();

    if (existing) {
      const hoursSince = (Date.now() - new Date(existing.last_snap_at).getTime()) / (1000 * 60 * 60);
      if (hoursSince >= 24) {
        // Streak broken, reset
        await supabase.from('snap_streaks').update({
          streak_count: 1, last_snap_by: user.id, last_snap_at: new Date().toISOString(),
          started_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
      } else {
        // Only increment if the OTHER person sent last (both must snap each day)
        const newCount = existing.last_snap_by !== user.id ? existing.streak_count + 1 : existing.streak_count;
        await supabase.from('snap_streaks').update({
          streak_count: newCount, last_snap_by: user.id,
          last_snap_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
      }
    } else {
      await supabase.from('snap_streaks').insert({
        user_id_1: id1, user_id_2: id2,
        streak_count: 1, last_snap_by: user.id,
      });
    }
    fetchStreaks();
  }, [user, fetchStreaks]);

  useEffect(() => { fetchStreaks(); }, [fetchStreaks]);

  return { streaks, loading, updateStreak, refreshStreaks: fetchStreaks };
}
