import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Keeps the current user's presence row alive.
 * Upserts every 30 s and sets status to 'offline' on unmount / page hide.
 */
export function usePresence() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;

    const upsert = async (status: string) => {
      try {
        await supabase.from('user_presence').upsert(
          {
            user_id: user.id,
            status,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      } catch (err) {
        console.warn('[usePresence] upsert failed:', err);
      }
    };

    // Go online immediately
    upsert('online');

    // Heartbeat every 30s
    intervalRef.current = setInterval(() => upsert('online'), 30_000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        upsert('away');
      } else {
        upsert('online');
      }
    };

    const handleBeforeUnload = () => {
      upsert('offline');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      upsert('offline');
    };
  }, [user]);
}
