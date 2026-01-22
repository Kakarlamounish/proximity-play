export interface SystemNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: any;
}

/**
 * Best-effort “push-like” notification while the app is open.
 * Uses Service Worker notifications when possible (better in background tabs),
 * otherwise falls back to the Notification constructor.
 */
export async function showSystemNotification(payload: SystemNotificationPayload) {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    // Prefer SW notifications (shows even when tab is backgrounded).
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(payload.title, {
        body: payload.body,
        icon: payload.icon,
        tag: payload.tag,
        data: payload.data,
      });
      return;
    }
  } catch {
    // fall through
  }

  try {
    // Fallback (still works when page is open).
    // eslint-disable-next-line no-new
    new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      tag: payload.tag,
      data: payload.data,
    });
  } catch {
    // ignore
  }
}
