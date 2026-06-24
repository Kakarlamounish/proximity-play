import { useEffect, useRef, useState } from 'react';

export interface SmartStatusSuggestion {
  emoji: string;
  label: string;
  /** Stable key for de-duplication / dismissals. */
  key: string;
}

interface Sample {
  lat: number;
  lng: number;
  t: number;
}

// Haversine, meters
function distMeters(a: Sample, b: Sample): number {
  const R = 6371e3;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function suggestionFromSpeed(speedMps: number): SmartStatusSuggestion | null {
  // m/s thresholds
  if (speedMps > 25) return { emoji: '✈️', label: 'Flying', key: 'flying' };
  if (speedMps > 8) return { emoji: '🚗', label: 'Driving', key: 'driving' };
  if (speedMps > 3) return { emoji: '🚴', label: 'Cycling', key: 'cycling' };
  if (speedMps > 1.2) return { emoji: '🚶', label: 'Walking', key: 'walking' };
  return null;
}

function timeBasedFallback(): SmartStatusSuggestion | null {
  const h = new Date().getHours();
  if (h >= 0 && h < 6) return { emoji: '😴', label: 'Sleeping', key: 'sleeping' };
  if (h >= 9 && h < 12) return { emoji: '💼', label: 'Working', key: 'working' };
  if (h >= 12 && h < 14) return { emoji: '🍽️', label: 'Lunch break', key: 'lunch' };
  if (h >= 19 && h < 23) return { emoji: '🛋️', label: 'Chilling', key: 'chilling' };
  return null;
}

/**
 * Watches geolocation and infers a smart status from movement speed.
 * Falls back to a time-of-day suggestion when stationary.
 */
export function useSmartStatus() {
  const [suggestion, setSuggestion] = useState<SmartStatusSuggestion | null>(null);
  const lastSample = useRef<Sample | null>(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setSuggestion(timeBasedFallback());
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now: Sample = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          t: pos.timestamp || Date.now(),
        };

        // Prefer browser-reported speed if available
        let speed = pos.coords.speed ?? null;
        if ((speed === null || Number.isNaN(speed)) && lastSample.current) {
          const dt = (now.t - lastSample.current.t) / 1000;
          if (dt > 0.5) {
            speed = distMeters(lastSample.current, now) / dt;
          }
        }
        lastSample.current = now;

        if (speed !== null && !Number.isNaN(speed)) {
          const fromSpeed = suggestionFromSpeed(speed);
          setSuggestion(fromSpeed ?? timeBasedFallback());
        } else {
          setSuggestion(timeBasedFallback());
        }
      },
      () => setSuggestion(timeBasedFallback()),
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 20_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return suggestion;
}
