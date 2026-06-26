import { useCallback, useRef } from 'react';

/**
 * Plays the custom WhatsApp notification sound from /public,
 * with a robust fallback to a Web Audio API synthesized chime.
 */
export function useNotificationSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSynthesizedFallback = useCallback(() => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
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
    } catch (e) {
      console.warn('Failed to play synthesized fallback chime:', e);
    }
  }, []);

  const play = useCallback(() => {
    try {
      if (!audioRef.current) {
        // Use the custom WhatsApp notification sound from /public
        audioRef.current = new Audio(encodeURI('/WhatsApp Audio 2026-06-25 at 5.48.32 PM.mp3'));
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.warn('Failed to play notification sound, falling back to synthesizer:', err);
        playSynthesizedFallback();
      });
    } catch (err) {
      console.warn('Error playing audio element, falling back to synthesizer:', err);
      playSynthesizedFallback();
    }
  }, [playSynthesizedFallback]);

  return { playNotificationSound: play };
}
