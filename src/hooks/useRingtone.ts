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

// Global audio instances to bypass Safari/Chrome autoplay restrictions
let globalAudio: HTMLAudioElement | null = null;
let globalContext: { audioContext: AudioContext; playTone: (freq: number, dur: number, delay?: number) => void } | null = null;

// Helper to unlock audio globally on first user interaction
const unlockGlobalAudio = () => {
  if (!globalAudio) {
    globalAudio = new Audio(encodeURI('/F1- Lose My Mind Ringtone Download - MobCup.Com.Co.mp3'));
    globalAudio.loop = true;
    globalAudio.volume = 0; // mute for unlocking
    globalAudio.play().then(() => {
      globalAudio!.pause();
      globalAudio!.currentTime = 0;
      globalAudio!.volume = 1;
    }).catch(() => {});
  }
  
  if (!globalContext) {
    try {
      globalContext = createRingtoneContext();
    } catch (e) {}
  }
  
  if (globalContext?.audioContext.state === 'suspended') {
    globalContext.audioContext.resume().catch(() => {});
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('click', unlockGlobalAudio, { once: true });
  window.addEventListener('touchstart', unlockGlobalAudio, { once: true });
}

export type RingtoneType = 'incoming' | 'outgoing' | 'hangup';

export const useRingtone = () => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);

  const initContext = useCallback(() => {
    if (!globalContext) {
      try {
        globalContext = createRingtoneContext();
      } catch (error) {
        console.warn('Failed to create audio context:', error);
      }
    }
    return globalContext;
  }, []);

  const playRingPattern = useCallback((type: RingtoneType) => {
    const context = initContext();
    if (!context) return;
    if (context.audioContext.state === 'suspended') {
      context.audioContext.resume().catch(() => {});
    }

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

    if (type === 'incoming' || type === 'outgoing') {
      // Play the local F1 "Lose My Mind" ringtone from /public
      if (!globalAudio) {
        globalAudio = new Audio(encodeURI('/F1- Lose My Mind Ringtone Download - MobCup.Com.Co.mp3'));
        globalAudio.loop = true;
      }
      globalAudio.currentTime = 0;
      globalAudio.play().catch(err => {
        console.warn('Failed to play F1 ringtone, falling back to synthesizer:', err);
        // Fallback to synthesizer ring pattern
        playRingPattern(type);
        const intervalDuration = type === 'incoming' ? 2000 : 3000;
        intervalRef.current = setInterval(() => {
          playRingPattern(type);
        }, intervalDuration);
      });
    } else {
      playRingPattern(type);
    }
  }, [playRingPattern]);

  const stopRinging = useCallback(() => {
    isPlayingRef.current = false;
    if (globalAudio) {
      try {
        globalAudio.pause();
        globalAudio.currentTime = 0;
      } catch (err) {
        console.warn('Failed to stop audio ringtone:', err);
      }
    }
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
      // We no longer close the audio context here because it's shared globally
    };
  }, [stopRinging]);

  return {
    startRinging,
    stopRinging,
    playOnce,
  };
};
