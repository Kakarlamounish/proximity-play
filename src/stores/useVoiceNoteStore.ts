import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface VoiceNote {
  id: string;
  url: string;        // signed URL ready for <audio src=...>
  storagePath: string;
  duration: number;
  chatId: string;
  senderId: string;
  createdAt: string;
  isPlayed: boolean;
}

interface VoiceNoteRow {
  id: string;
  url: string; // stored as the storage path in DB
  duration: number;
  chat_id: string;
  sender_id: string;
  is_played: boolean;
  created_at: string;
}

const BUCKET = 'voice-notes';

async function pathToSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60); // 1h
  if (error || !data) {
    console.error('pathToSignedUrl error:', error);
    return '';
  }
  return data.signedUrl;
}

async function rowToVoiceNote(r: VoiceNoteRow): Promise<VoiceNote> {
  return {
    id: r.id,
    url: await pathToSignedUrl(r.url),
    storagePath: r.url,
    duration: r.duration,
    chatId: r.chat_id,
    senderId: r.sender_id,
    createdAt: r.created_at,
    isPlayed: r.is_played,
  };
}

interface VoiceNoteState {
  voiceNotes: VoiceNote[];
  isRecording: boolean;
  recordingBlob: Blob | null;
  loading: boolean;
  fetchVoiceNotesForChat: (chatId: string) => Promise<void>;
  uploadAndAddVoiceNote: (params: {
    blob: Blob;
    duration: number;
    chatId: string;
    senderId: string;
  }) => Promise<{ url: string, duration: number } | null>;
  markAsPlayed: (id: string) => Promise<void>;
  setRecording: (isRecording: boolean) => void;
  setRecordingBlob: (blob: Blob | null) => void;
  getVoiceNotesForChat: (chatId: string) => VoiceNote[];
}

export const useVoiceNoteStore = create<VoiceNoteState>()((set, get) => ({
  voiceNotes: [],
  isRecording: false,
  recordingBlob: null,
  loading: false,

  fetchVoiceNotesForChat: async (chatId) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('voice_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('fetchVoiceNotesForChat error:', error);
      set({ loading: false });
      return;
    }
    const notes = await Promise.all(
      (data as VoiceNoteRow[]).map(rowToVoiceNote)
    );
    set((s) => ({
      voiceNotes: [
        ...s.voiceNotes.filter((n) => n.chatId !== chatId),
        ...notes,
      ],
      loading: false,
    }));
  },

  uploadAndAddVoiceNote: async ({ blob, duration, chatId, senderId }) => {
    const ext = blob.type.includes('webm') ? 'webm' : 'm4a';
    const path = `${senderId}/${chatId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: blob.type || 'audio/webm', upsert: false });
    if (upErr) {
      console.error('voice upload error:', upErr);
      return null;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(path);
      
    return { url: publicUrl, duration };
  },

  markAsPlayed: async (id) => {
    set((s) => ({
      voiceNotes: s.voiceNotes.map((n) =>
        n.id === id ? { ...n, isPlayed: true } : n
      ),
    }));
    const { error } = await supabase
      .from('voice_messages')
      .update({ is_played: true })
      .eq('id', id);
    if (error) console.error('markAsPlayed error:', error);
  },

  setRecording: (isRecording) => set({ isRecording }),
  setRecordingBlob: (blob) => set({ recordingBlob: blob }),
  getVoiceNotesForChat: (chatId) =>
    get().voiceNotes.filter((n) => n.chatId === chatId),
}));
