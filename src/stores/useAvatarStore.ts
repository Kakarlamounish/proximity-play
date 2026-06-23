import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AvatarIcon = 
  | 'user' | 'car' | 'bike' | 'walk' | 'home' | 'work' 
  | 'coffee' | 'restaurant' | 'gym' | 'park' | 'school'
  | 'shopping' | 'airport' | 'train' | 'bus' | 'boat'
  | 'dog' | 'cat' | 'star' | 'heart' | 'flag';

export const AVATAR_ICONS: AvatarIcon[] = [
  'user', 'car', 'bike', 'walk', 'home', 'work',
  'coffee', 'restaurant', 'gym', 'park', 'school',
  'shopping', 'airport', 'train', 'bus', 'boat',
  'dog', 'cat', 'star', 'heart', 'flag'
];

export const AVATAR_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
];

interface UserAvatar {
  userId: string;
  icon: AvatarIcon;
  color: string;
  customImageUrl?: string;
}

interface AvatarState {
  avatars: Record<string, UserAvatar>;
  setAvatar: (userId: string, avatar: Omit<UserAvatar, 'userId'>) => void;
  getAvatar: (userId: string) => UserAvatar | undefined;
}

export const useAvatarStore = create<AvatarState>()(
  persist(
    (set, get) => ({
      avatars: {},
      setAvatar: (userId, avatar) =>
        set((state) => ({
          avatars: {
            ...state.avatars,
            [userId]: { ...avatar, userId },
          },
        })),
      getAvatar: (userId) => get().avatars[userId],
    }),
    {
      name: 'avatar-storage',
    }
  )
);
