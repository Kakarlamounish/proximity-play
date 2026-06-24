import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Send, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface VoiceRecorderProps {
  onVoiceMessage: (audioUrl: string, duration: number) => void;
  disabled?: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ 
  onVoiceMessage, 
  disabled = false 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [waveformValues, setWaveformValues] = useState<number[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const { toast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const updateWaveform = () => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Sample 20 values from the frequency data
    const samples = 20;
    const step = Math.floor(dataArray.length / samples);
    const values = Array.from({ length: samples }, (_, i) => {
      const value = dataArray[i * step] / 255;
      return Math.max(0.1, value);
    });
    
    setWaveformValues(values);
    
    if (isRecording) {
      animationRef.current = requestAnimationFrame(updateWaveform);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Set up audio analyser for waveform
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      // Try to use webm first, fall back to other formats
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = '';
          }
        }
      }
      
      const options = mimeType ? { mimeType } : undefined;
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        if (audioBlob.size > 0) {
          await uploadVoiceMessage(audioBlob);
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
      };

      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      setRecordingDuration(0);
      setWaveformValues(Array(20).fill(0.1));

      // Start duration timer
      intervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // Start waveform animation
      animationRef.current = requestAnimationFrame(updateWaveform);

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Recording Error',
        description: 'Could not access microphone. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      audioChunksRef.current = []; // Clear chunks so nothing uploads
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingDuration(0);
      setWaveformValues([]);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const uploadVoiceMessage = async (audioBlob: Blob) => {
    if (audioBlob.size === 0) return;
    
    setIsUploading(true);
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? 'anonymous';
      const fileName = `voice_${Date.now()}.webm`;
      const path = `${userId}/${fileName}`;
      const { data, error } = await supabase.storage
        .from('voice-notes')
        .upload(path, audioBlob, {
          contentType: 'audio/webm',
        });

      if (error) throw error;

      const { data: signed, error: signErr } = await supabase.storage
        .from('voice-notes')
        .createSignedUrl(data.path, 60 * 60 * 24 * 7);
      if (signErr || !signed) throw signErr ?? new Error('Failed to sign URL');

      onVoiceMessage(signed.signedUrl, recordingDuration);

      toast({
        title: 'Voice message sent',
        description: 'Your voice message has been uploaded successfully.',
      });

    } catch (error) {
      console.error('Error uploading voice message:', error);
      toast({
        title: 'Upload Error',
        description: 'Failed to upload voice message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setRecordingDuration(0);
      setWaveformValues([]);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isUploading) {
    return (
      <Button disabled size="sm" className="bg-primary/20">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Sending...
      </Button>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-2 flex-1">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-destructive/10 rounded-lg">
          <div className="w-2 h-2 bg-destructive rounded-full animate-pulse flex-shrink-0" />
          
          {/* Live Waveform */}
          <div className="flex items-center gap-[2px] h-6 flex-1">
            {waveformValues.map((value, index) => (
              <div
                key={index}
                className="w-1 bg-destructive rounded-full transition-all duration-75"
                style={{ height: `${value * 100}%` }}
              />
            ))}
          </div>
          
          <span className="text-sm font-medium text-destructive min-w-[40px]">
            {formatDuration(recordingDuration)}
          </span>
        </div>
        
        <Button 
          onClick={cancelRecording}
          size="sm"
          variant="outline"
          className="flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
        
        <Button 
          onClick={stopRecording}
          size="sm"
          className="bg-gradient-to-r from-secondary to-primary flex-shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={startRecording}
      disabled={disabled}
      size="icon"
      variant="outline"
      className="hover:bg-primary/10 flex-shrink-0"
    >
      <Mic className="h-4 w-4" />
    </Button>
  );
};