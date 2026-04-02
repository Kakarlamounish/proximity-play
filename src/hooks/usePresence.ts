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
      await supabase.from('user_presence').upsert(
        {
          user_id: user.id,
          status,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
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
      // Use sendBeacon for reliability
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_presence?user_id=eq.${user.id}`;
      const body = JSON.stringify({ status: 'offline', last_seen: new Date().toISOString() });
      navigator.sendBeacon?.(url); // best-effort
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
