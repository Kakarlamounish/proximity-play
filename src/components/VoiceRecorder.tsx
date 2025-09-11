import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Send, Loader2 } from 'lucide-react';
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadVoiceMessage(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      intervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

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

  const uploadVoiceMessage = async (audioBlob: Blob) => {
    setIsUploading(true);
    
    try {
      const fileName = `voice_${Date.now()}.webm`;
      const { data, error } = await supabase.storage
        .from('profile-photos') // Reusing existing bucket for now
        .upload(`voice-messages/${fileName}`, audioBlob, {
          contentType: 'audio/webm',
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(data.path);

      onVoiceMessage(publicUrl, recordingDuration);
      
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
        Uploading...
      </Button>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 rounded-lg">
          <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
          <span className="text-sm font-medium text-destructive">
            {formatDuration(recordingDuration)}
          </span>
        </div>
        <Button 
          onClick={stopRecording}
          size="sm"
          variant="destructive"
        >
          <Send className="h-4 w-4" />
        </Button>
        <Button 
          onClick={() => {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            setRecordingDuration(0);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          }}
          size="sm"
          variant="outline"
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={startRecording}
      disabled={disabled}
      size="sm"
      variant="outline"
      className="hover:bg-primary/10"
    >
      <Mic className="h-4 w-4" />
    </Button>
  );
};