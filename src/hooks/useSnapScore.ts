import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SnapScore {
  snaps_sent: number;
  snaps_received: number;
  stories_posted: number;
  total_score: number;
}

export function useSnapScore(userId?: string) {
  const { user } = useAuth();
  const targetId = userId || user?.id;
  const [score, setScore] = useState<SnapScore>({ snaps_sent: 0, snaps_received: 0, stories_posted: 0, total_score: 0 });

  const fetchScore = useCallback(async () => {
    if (!targetId) return;
    const { data } = await supabase
      .from('snap_scores')
      .select('snaps_sent, snaps_received, stories_posted, total_score')
      .eq('user_id', targetId)
      .maybeSingle();
    if (data) setScore(data);
  }, [targetId]);

  const incrementScore = useCallback(async (field: 'snaps_sent' | 'snaps_received' | 'stories_posted', amount = 1) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from('snap_scores')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      const newVal = (existing[field] || 0) + amount;
      const newTotal = (existing.snaps_sent + existing.snaps_received + existing.stories_posted) + amount;
      await supabase.from('snap_scores').update({
        [field]: newVal,
        total_score: newTotal,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
    } else {
      const init = { snaps_sent: 0, snaps_received: 0, stories_posted: 0, [field]: amount };
      await supabase.from('snap_scores').insert({
        user_id: user.id,
        ...init,
        total_score: amount,
      });
    }
    fetchScore();
  }, [user, fetchScore]);

  useEffect(() => { fetchScore(); }, [fetchScore]);

  return { score, incrementScore, refreshScore: fetchScore };
}
