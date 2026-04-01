import { useCallback, useRef } from 'react';

/**
 * Plays a short pleasant notification chime using Web Audio API.
 */
export function useNotificationSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  const play = useCallback(() => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = ctxRef.current;
      const now = ctx.currentTime;

      // Two-note chime: C5 → E5
      const notes = [
        { freq: 523.25, start: 0, dur: 0.15 },
        { freq: 659.25, start: 0.12, dur: 0.2 },
      ];

      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = n.freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, now + n.start);
        gain.gain.linearRampToValueAtTime(0.25, now + n.start + 0.03);
        gain.gain.linearRampToValueAtTime(0, now + n.start + n.dur);
        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur);
      }
    } catch {
      // Audio not available
    }
  }, []);

  return { playNotificationSound: play };
}
