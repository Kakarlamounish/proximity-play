import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export type AvatarIcon =
  | 'user' | 'car' | 'bike' | 'walk' | 'home' | 'work'
  | 'coffee' | 'restaurant' | 'gym' | 'park' | 'school'
  | 'shopping' | 'airport' | 'train' | 'bus' | 'boat'
  | 'dog' | 'cat' | 'star' | 'heart' | 'flag';

export const AVATAR_ICONS: AvatarIcon[] = [
  'user', 'car', 'bike', 'walk', 'home', 'work',
  'coffee', 'restaurant', 'gym', 'park', 'school',
  'shopping', 'airport', 'train', 'bus', 'boat',
  'dog', 'cat', 'star', 'heart', 'flag',
];

export const AVATAR_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

export interface UserAvatar {
  userId: string;
  icon: AvatarIcon;
  color: string;
  customImageUrl?: string;
}

interface AvatarState {
  avatars: Record<string, UserAvatar>;
  loading: boolean;
  fetchAvatar: (userId: string) => Promise<UserAvatar | undefined>;
  fetchAvatars: (userIds: string[]) => Promise<void>;
  setAvatar: (userId: string, avatar: Omit<UserAvatar, 'userId'>) => Promise<void>;
  getAvatar: (userId: string) => UserAvatar | undefined;
}

export const useAvatarStore = create<AvatarState>()((set, get) => ({
  avatars: {},
  loading: false,

  fetchAvatar: async (userId) => {
    const { data, error } = await supabase
      .from('user_avatars')
      .select('user_id, icon, color, custom_image_url')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.error('fetchAvatar error:', error);
      return undefined;
    }
    if (!data) return undefined;
    const ua: UserAvatar = {
      userId: data.user_id,
      icon: data.icon as AvatarIcon,
      color: data.color,
      customImageUrl: data.custom_image_url ?? undefined,
    };
    set((s) => ({ avatars: { ...s.avatars, [userId]: ua } }));
    return ua;
  },

  fetchAvatars: async (userIds) => {
    if (userIds.length === 0) return;
    set({ loading: true });
    const { data, error } = await supabase
      .from('user_avatars')
      .select('user_id, icon, color, custom_image_url')
      .in('user_id', userIds);
    if (error) {
      console.error('fetchAvatars error:', error);
      set({ loading: false });
      return;
    }
    const map = { ...get().avatars };
    (data ?? []).forEach((row) => {
      map[row.user_id] = {
        userId: row.user_id,
        icon: row.icon as AvatarIcon,
        color: row.color,
        customImageUrl: row.custom_image_url ?? undefined,
      };
    });
    set({ avatars: map, loading: false });
  },

  setAvatar: async (userId, avatar) => {
    // Optimistic
    set((s) => ({ avatars: { ...s.avatars, [userId]: { ...avatar, userId } } }));
    const { error } = await supabase.from('user_avatars').upsert(
      {
        user_id: userId,
        icon: avatar.icon,
        color: avatar.color,
        custom_image_url: avatar.customImageUrl ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (error) console.error('setAvatar error:', error);
  },

  getAvatar: (userId) => get().avatars[userId],
}));
