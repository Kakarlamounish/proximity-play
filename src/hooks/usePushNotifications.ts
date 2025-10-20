import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';

interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  requireInteraction?: boolean;
  silent?: boolean;
  tag?: string;
}

export const usePushNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const { addNotification } = useAppStore();

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Check if user is subscribed to push notifications
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((existingSubscription) => {
          if (existingSubscription) {
            setIsSubscribed(true);
            setSubscription(existingSubscription);
          }
        });
      });
    }
  }, []);

  // Request notification permission
  const requestPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        addNotification({
          id: 'notification-permission-granted',
          type: 'system',
          title: 'Notifications Enabled',
          message: 'You will now receive push notifications from Proximity Play.',
          read: false,
          createdAt: new Date().toISOString(),
        });
        return true;
      } else {
        addNotification({
          id: 'notification-permission-denied',
          type: 'system',
          title: 'Notifications Disabled',
          message: 'You can enable notifications in your browser settings.',
          read: false,
          createdAt: new Date().toISOString(),
        });
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  // Subscribe to push notifications
  const subscribe = async (vapidPublicKey?: string): Promise<boolean> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push messaging is not supported');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription) {
        setIsSubscribed(true);
        setSubscription(existingSubscription);
        return true;
      }

      // Convert VAPID key to Uint8Array
      const applicationServerKey = vapidPublicKey
        ? urlBase64ToUint8Array(vapidPublicKey) as BufferSource
        : undefined;

      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      setIsSubscribed(true);
      setSubscription(newSubscription);

      // Send subscription to server
      await sendSubscriptionToServer(newSubscription);

      addNotification({
        id: 'push-subscription-success',
        type: 'system',
        title: 'Push Notifications Active',
        message: 'You are now subscribed to push notifications.',
        read: false,
        createdAt: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      addNotification({
        id: 'push-subscription-error',
        type: 'system',
        title: 'Subscription Failed',
        message: 'Failed to subscribe to push notifications. Please try again.',
        read: false,
        createdAt: new Date().toISOString(),
      });
      return false;
    }
  };

  // Unsubscribe from push notifications
  const unsubscribe = async (): Promise<boolean> => {
    if (!subscription) return true;

    try {
      const result = await subscription.unsubscribe();
      if (result) {
        setIsSubscribed(false);
        setSubscription(null);
        await removeSubscriptionFromServer(subscription);
      }
      return result;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    }
  };

  // Send notification (for testing)
  const sendNotification = (payload: PushNotificationPayload) => {
    if (permission === 'granted') {
      new Notification(payload.title, {
        body: payload.body,
        icon: payload.icon || '/icon-192x192.png',
        badge: payload.badge || '/badge-72x72.png',
        data: payload.data,
        requireInteraction: payload.requireInteraction,
        silent: payload.silent,
        tag: payload.tag,
      });
    }
  };

  // Send subscription to server
  const sendSubscriptionToServer = async (subscription: PushSubscription) => {
    try {
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to server');
      }
    } catch (error) {
      console.error('Error sending subscription to server:', error);
    }
  };

  // Remove subscription from server
  const removeSubscriptionFromServer = async (subscription: PushSubscription) => {
    try {
      const response = await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove subscription from server');
      }
    } catch (error) {
      console.error('Error removing subscription from server:', error);
    }
  };

  // Utility function to convert VAPID key
  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  return {
    permission,
    isSubscribed,
    subscription,
    requestPermission,
    subscribe,
    unsubscribe,
    sendNotification,
  };
};
