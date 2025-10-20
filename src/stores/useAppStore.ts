import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Database } from '@/integrations/supabase/types';

type User = Database['public']['Tables']['profiles']['Row'] & {
  // Extended user interface
};

type Bubble = Database['public']['Tables']['bubbles']['Row'] & {
  // Extended bubble interface
};

interface Message {
  id: string;
  content: string;
  senderId: string;
  bubbleId: string;
  createdAt: string;
  sender?: User;
}

interface Notification {
  id: string;
  type: 'message' | 'friend_request' | 'bubble_invite' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: any;
}

interface AppState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Bubbles state
  bubbles: Bubble[];
  currentBubble: Bubble | null;
  userBubbles: Bubble[];

  // Messages state
  messages: Record<string, Message[]>; // bubbleId -> messages
  unreadCounts: Record<string, number>; // bubbleId -> count

  // Friends state
  friends: User[];
  friendRequests: any[];
  suggestedFriends: User[];

  // UI state
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  notifications: Notification[];
  unreadNotificationsCount: number;

  // Location state
  userLocation: { lat: number; lng: number } | null;
  locationSharing: boolean;

  // Settings
  settings: {
    notifications: {
      messages: boolean;
      friends: boolean;
      bubbles: boolean;
      system: boolean;
    };
    privacy: {
      locationSharing: boolean;
      profileVisibility: boolean;
      ghostMode: boolean;
    };
    preferences: {
      language: string;
      timezone: string;
    };
  };

  // Actions
  setUser: (user: User | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setLoading: (isLoading: boolean) => void;

  setBubbles: (bubbles: Bubble[]) => void;
  setCurrentBubble: (bubble: Bubble | null) => void;
  setUserBubbles: (bubbles: Bubble[]) => void;

  addMessage: (bubbleId: string, message: Message) => void;
  setMessages: (bubbleId: string, messages: Message[]) => void;
  markMessagesAsRead: (bubbleId: string) => void;

  setFriends: (friends: User[]) => void;
  setFriendRequests: (requests: any[]) => void;
  setSuggestedFriends: (friends: User[]) => void;

  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;

  addNotification: (notification: Notification) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;

  setUserLocation: (location: { lat: number; lng: number } | null) => void;
  setLocationSharing: (enabled: boolean) => void;

  updateSettings: (settings: Partial<AppState['settings']>) => void;

  // Async actions
  initializeApp: () => Promise<void>;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        isAuthenticated: false,
        isLoading: true,

        bubbles: [],
        currentBubble: null,
        userBubbles: [],

        messages: {},
        unreadCounts: {},

        friends: [],
        friendRequests: [],
        suggestedFriends: [],

        theme: 'system',
        sidebarOpen: false,
        notifications: [],
        unreadNotificationsCount: 0,

        userLocation: null,
        locationSharing: false,

        settings: {
          notifications: {
            messages: true,
            friends: true,
            bubbles: true,
            system: true,
          },
          privacy: {
            locationSharing: true,
            profileVisibility: true,
            ghostMode: false,
          },
          preferences: {
            language: 'en',
            timezone: 'UTC',
          },
        },

        // Actions
        setUser: (user) => set({ user }),
        setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
        setLoading: (isLoading) => set({ isLoading }),

        setBubbles: (bubbles) => set({ bubbles }),
        setCurrentBubble: (currentBubble) => set({ currentBubble }),
        setUserBubbles: (userBubbles) => set({ userBubbles }),

        addMessage: (bubbleId, message) =>
          set((state) => ({
            messages: {
              ...state.messages,
              [bubbleId]: [...(state.messages[bubbleId] || []), message],
            },
            unreadCounts: {
              ...state.unreadCounts,
              [bubbleId]: (state.unreadCounts[bubbleId] || 0) + 1,
            },
          })),

        setMessages: (bubbleId, messages) =>
          set((state) => ({
            messages: {
              ...state.messages,
              [bubbleId]: messages,
            },
          })),

        markMessagesAsRead: (bubbleId) =>
          set((state) => ({
            unreadCounts: {
              ...state.unreadCounts,
              [bubbleId]: 0,
            },
          })),

        setFriends: (friends) => set({ friends }),
        setFriendRequests: (friendRequests) => set({ friendRequests }),
        setSuggestedFriends: (suggestedFriends) => set({ suggestedFriends }),

        setTheme: (theme) => set({ theme }),
        toggleSidebar: () =>
          set((state) => ({ sidebarOpen: !state.sidebarOpen })),

        addNotification: (notification) =>
          set((state) => ({
            notifications: [notification, ...state.notifications],
            unreadNotificationsCount: state.unreadNotificationsCount + 1,
          })),

        markNotificationAsRead: (id) =>
          set((state) => ({
            notifications: state.notifications.map((n) =>
              n.id === id ? { ...n, read: true } : n
            ),
            unreadNotificationsCount: Math.max(
              0,
              state.unreadNotificationsCount - 1
            ),
          })),

        markAllNotificationsAsRead: () =>
          set((state) => ({
            notifications: state.notifications.map((n) => ({
              ...n,
              read: true,
            })),
            unreadNotificationsCount: 0,
          })),

        setUserLocation: (userLocation) => set({ userLocation }),
        setLocationSharing: (locationSharing) => set({ locationSharing }),

        updateSettings: (newSettings) =>
          set((state) => ({
            settings: { ...state.settings, ...newSettings },
          })),

        initializeApp: async () => {
          try {
            // Initialize app state
            set({ isLoading: true });

            // Load persisted data and sync with server
            // This would typically involve API calls to sync state

            set({ isLoading: false });
          } catch (error) {
            console.error('Failed to initialize app:', error);
            set({ isLoading: false });
          }
        },

        logout: () =>
          set({
            user: null,
            isAuthenticated: false,
            currentBubble: null,
            userBubbles: [],
            messages: {},
            unreadCounts: {},
            friends: [],
            friendRequests: [],
            suggestedFriends: [],
            notifications: [],
            unreadNotificationsCount: 0,
            userLocation: null,
            locationSharing: false,
          }),
      }),
      {
        name: 'proximity-play-store',
        partialize: (state) => ({
          theme: state.theme,
          settings: state.settings,
          locationSharing: state.locationSharing,
        }),
      }
    ),
    {
      name: 'Proximity Play Store',
    }
  )
);

// Selectors for better performance
export const useUser = () => useAppStore((state) => state.user);
export const useIsAuthenticated = () => useAppStore((state) => state.isAuthenticated);
export const useCurrentBubble = () => useAppStore((state) => state.currentBubble);
export const useMessages = (bubbleId: string) =>
  useAppStore((state) => state.messages[bubbleId] || []);
export const useUnreadCount = (bubbleId: string) =>
  useAppStore((state) => state.unreadCounts[bubbleId] || 0);
export const useNotifications = () => useAppStore((state) => state.notifications);
export const useSettings = () => useAppStore((state) => state.settings);
export const useTheme = () => useAppStore((state) => state.theme);