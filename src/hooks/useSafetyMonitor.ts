import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LocationSample {
  lat: number;
  lng: number;
  timestamp: number;
}

interface SafetyMonitorOptions {
  /** Meters — if user doesn't move more than this over the window, considered stationary */
  stationaryThresholdMeters?: number;
  /** Minutes to wait before prompting (default: 20) */
  stationaryWindowMinutes?: number;
  /** User ID for emergency contacts lookup */
  userId?: string;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Watches location history for unusual stillness (potential emergency).
 * Fires a toast prompt asking "Are you okay?" after configurable inactivity.
 */
export function useSafetyMonitor({
  stationaryThresholdMeters = 500,
  stationaryWindowMinutes = 20,
  userId,
}: SafetyMonitorOptions = {}) {
  const { toast } = useToast();
  const samplesRef = useRef<LocationSample[]>([]);
  const promptedRef = useRef<number>(0); // last prompt timestamp
  const watchIdRef = useRef<number | null>(null);
  const dismissedRef = useRef(false);

  const checkSafety = useCallback(() => {
    const samples = samplesRef.current;
    if (samples.length < 3) return;

    const windowMs = stationaryWindowMinutes * 60 * 1000;
    const now = Date.now();
    const recentSamples = samples.filter(s => now - s.timestamp < windowMs);
    if (recentSamples.length < 3) return;

    // Calculate total movement over the window
    let totalMovement = 0;
    for (let i = 1; i < recentSamples.length; i++) {
      totalMovement += haversineDistance(
        recentSamples[i - 1].lat, recentSamples[i - 1].lng,
        recentSamples[i].lat, recentSamples[i].lng,
      );
    }

    const isStationary = totalMovement < stationaryThresholdMeters;
    const timeSinceLastPrompt = now - promptedRef.current;
    const cooldownMs = 30 * 60 * 1000; // 30 min cooldown

    if (isStationary && timeSinceLastPrompt > cooldownMs && !dismissedRef.current) {
      promptedRef.current = now;
      dismissedRef.current = true; // reset after user responds

      // Log the stationary alert to Supabase (silent fail if table doesn't exist yet)
      if (userId) {
        supabase.from('safety_alerts').insert({
          user_id: userId,
          type: 'stationary_alert',
          latitude: recentSamples[recentSamples.length - 1].lat,
          longitude: recentSamples[recentSamples.length - 1].lng,
          created_at: new Date().toISOString(),
        }).catch(() => { /* silent if table doesn't exist */ });
      }

      // Fire a simple toast — no JSX in .ts file
      toast({
        title: '🛡️ Safety Check',
        description: `You haven't moved in ${stationaryWindowMinutes} minutes. Tap to confirm you're okay.`,
        duration: 30_000,
      });

      // Auto-reset dismissed flag after cooldown so the next check can fire
      setTimeout(() => { dismissedRef.current = false; }, cooldownMs);
    }
  }, [stationaryThresholdMeters, stationaryWindowMinutes, toast, userId]);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const sample: LocationSample = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: pos.timestamp || Date.now(),
        };

        // Keep only last 60 samples
        samplesRef.current = [...samplesRef.current.slice(-59), sample];
        checkSafety();
      },
      () => { /* ignore errors */ },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 30_000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [checkSafety]);
}
