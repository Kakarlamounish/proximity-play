import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  duration?: number;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({ 
  audioUrl, 
  duration = 0 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration);
  const [waveformBars, setWaveformBars] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Generate random waveform visualization bars
  useEffect(() => {
    const bars = Array.from({ length: 30 }, () => Math.random() * 0.7 + 0.3);
    setWaveformBars(bars);
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg min-w-[200px]">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlayback}
        className="h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 text-primary" />
        ) : (
          <Play className="h-4 w-4 text-primary ml-0.5" />
        )}
      </Button>

      {/* Waveform Visualization */}
      <div className="flex-1 flex items-center gap-[2px] h-8">
        {waveformBars.map((height, index) => {
          const barProgress = (index / waveformBars.length) * 100;
          const isActive = barProgress <= progress;
          
          return (
            <div
              key={index}
              className={`w-1 rounded-full transition-colors ${
                isActive ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
              style={{ height: `${height * 100}%` }}
            />
          );
        })}
      </div>

      <span className="text-xs text-muted-foreground min-w-[40px] text-right">
        {formatTime(isPlaying ? currentTime : audioDuration)}
      </span>
    </div>
  );
};
