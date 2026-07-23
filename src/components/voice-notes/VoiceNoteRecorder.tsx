import React, { useState, useRef, useEffect } from 'react';
import { useVoiceNoteStore } from '../../stores/useVoiceNoteStore';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface VoiceNoteRecorderProps {
  chatId: string;
  onUploadComplete: (url?: string, duration?: number) => void;
}

export const VoiceNoteRecorder: React.FC<VoiceNoteRecorderProps> = ({
  chatId,
  onUploadComplete,
}) => {
  const [recordingTime, setRecordingTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const setRecording = useVoiceNoteStore((state) => state.setRecording);
  const uploadAndAddVoiceNote = useVoiceNoteStore((state) => state.uploadAndAddVoiceNote);
  const { user } = useAuth();
  const { toast } = useToast();

  const startRecording = async () => {
    if (!user) {
      toast({ title: 'Please sign in to record voice notes.', variant: 'destructive' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setUploading(true);
        const result = await uploadAndAddVoiceNote({
          blob,
          duration: recordingTime,
          chatId,
          senderId: user.id,
        });
        setUploading(false);

        stream.getTracks().forEach((track) => track.stop());
        if (result) {
          onUploadComplete(result.url, result.duration);
        } else {
          onUploadComplete();
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({ title: 'Microphone access denied. Please enable microphone permissions.', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center space-x-3 p-2">
      {!isRecording ? (
        <button
          onClick={startRecording}
          className="flex items-center justify-center w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
          aria-label="Start recording voice note"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        </button>
      ) : (
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-red-500 rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 16 + 8}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {formatTime(recordingTime)}
          </span>
          <button
            onClick={stopRecording}
            className="flex items-center justify-center w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
            aria-label="Stop recording"
          >
            <div className="w-3 h-3 bg-white rounded-sm" />
          </button>
        </div>
      )}
    </div>
  );
};
