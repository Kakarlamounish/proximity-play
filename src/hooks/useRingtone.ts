import { useRef, useCallback, useEffect } from 'react';

// Generate a simple ringtone using Web Audio API
const createRingtoneContext = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  const playTone = (frequency: number, duration: number, delay: number = 0) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime + delay);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + delay + 0.05);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + delay + duration - 0.05);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + delay + duration);
    
    oscillator.start(audioContext.currentTime + delay);
    oscillator.stop(audioContext.currentTime + delay + duration);
  };
  
  return { audioContext, playTone };
};

export type RingtoneType = 'incoming' | 'outgoing' | 'hangup';

export const useRingtone = () => {
  const contextRef = useRef<{ audioContext: AudioContext; playTone: (freq: number, dur: number, delay?: number) => void } | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);

  const initContext = useCallback(() => {
    if (!contextRef.current) {
      try {
        contextRef.current = createRingtoneContext();
      } catch (error) {
        console.warn('Failed to create audio context:', error);
      }
    }
    return contextRef.current;
  }, []);

  const playRingPattern = useCallback((type: RingtoneType) => {
    const context = initContext();
    if (!context) return;

    if (type === 'incoming') {
      // Classic phone ring pattern - two quick tones
      context.playTone(440, 0.15, 0);
      context.playTone(480, 0.15, 0);
      context.playTone(440, 0.15, 0.2);
      context.playTone(480, 0.15, 0.2);
    } else if (type === 'outgoing') {
      // Single long tone for dialing/ringing
      context.playTone(440, 0.8, 0);
    } else if (type === 'hangup') {
      // Descending tone for hangup
      context.playTone(480, 0.1, 0);
      context.playTone(440, 0.1, 0.12);
      context.playTone(400, 0.1, 0.24);
      context.playTone(360, 0.2, 0.36);
    }
  }, [initContext]);

  const startRinging = useCallback((type: RingtoneType = 'incoming') => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    // Play immediately
    playRingPattern(type);

    // Repeat pattern
    const intervalDuration = type === 'incoming' ? 2000 : 3000;
    intervalRef.current = setInterval(() => {
      playRingPattern(type);
    }, intervalDuration);
  }, [playRingPattern]);

  const stopRinging = useCallback(() => {
    isPlayingRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const playOnce = useCallback((type: RingtoneType) => {
    playRingPattern(type);
  }, [playRingPattern]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRinging();
      if (contextRef.current?.audioContext) {
        contextRef.current.audioContext.close().catch(() => {});
      }
    };
  }, [stopRinging]);

  return {
    startRinging,
    stopRinging,
    playOnce,
  };
};
