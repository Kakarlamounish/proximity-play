// Settings previously wrote these toggles to localStorage but nothing ever
// read them back — every in-app notification toast/sound fired regardless of
// what the user had disabled. This is the shared shape + lookup both
// Settings (writer) and useRealtimeNotifications (reader) use so a toggle
// flip actually changes behavior.
export interface NotificationPreferences {
  messages: boolean;
  meetups: boolean;
  bubbles: boolean;
  calls: boolean;
  friendRequests: boolean;
  stories: boolean;
  push: boolean;
  email: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  messages: true,
  meetups: true,
  bubbles: true,
  calls: true,
  friendRequests: true,
  stories: true,
  push: true,
  email: false,
};

const STORAGE_KEY = 'notification-preferences';

export function getNotificationPreferences(): NotificationPreferences {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_NOTIFICATION_PREFERENCES;
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(saved) };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

// Maps a `notifications.type` DB value (or the synthetic 'bubble_message'
// used for realtime bubble chat toasts) to the Settings category that
// controls it.
const TYPE_TO_CATEGORY: Record<string, keyof NotificationPreferences> = {
  message: 'messages',
  bubble_message: 'bubbles',
  bubble_join: 'bubbles',
  missed_call: 'calls',
  friend_request: 'friendRequests',
  friend_request_accepted: 'friendRequests',
  story_reaction: 'stories',
  meetup: 'meetups',
};

export function isNotificationCategoryEnabled(type: string | null | undefined): boolean {
  if (!type) return true;
  const category = TYPE_TO_CATEGORY[type];
  if (!category) return true; // unknown types aren't silenced by default
  return getNotificationPreferences()[category];
}
