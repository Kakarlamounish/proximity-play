import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface VoiceNote {
  id: string;
  url: string;
  duration: number; // in seconds
  chatId: string;
  senderId: string;
  createdAt: Date;
  isPlayed: boolean;
}

interface VoiceNoteState {
  voiceNotes: VoiceNote[];
  isRecording: boolean;
  recordingBlob: Blob | null;
  addVoiceNote: (note: Omit<VoiceNote, 'id' | 'createdAt' | 'isPlayed'>) => void;
  markAsPlayed: (id: string) => void;
  setRecording: (isRecording: boolean) => void;
  setRecordingBlob: (blob: Blob | null) => void;
  getVoiceNotesForChat: (chatId: string) => VoiceNote[];
}

export const useVoiceNoteStore = create<VoiceNoteState>()(
  persist(
    (set, get) => ({
      voiceNotes: [],
      isRecording: false,
      recordingBlob: null,
      addVoiceNote: (note) =>
        set((state) => ({
          voiceNotes: [
            ...state.voiceNotes,
            { ...note, id: crypto.randomUUID(), createdAt: new Date(), isPlayed: false },
          ],
        })),
      markAsPlayed: (id) =>
        set((state) => ({
          voiceNotes: state.voiceNotes.map((n) =>
            n.id === id ? { ...n, isPlayed: true } : n
          ),
        })),
      setRecording: (isRecording) => set({ isRecording }),
      setRecordingBlob: (blob) => set({ recordingBlob: blob }),
      getVoiceNotesForChat: (chatId) =>
        get().voiceNotes.filter((n) => n.chatId === chatId),
    }),
    {
      name: 'voice-note-storage',
    }
  )
);
