import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const usePWA = () => {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { addNotification } = useAppStore();

  // Handle PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);

      // Show install notification
      addNotification({
        id: 'pwa-install',
        type: 'system',
        title: 'Install Proximity Play',
        message: 'Install our app for a better experience with offline access and push notifications.',
        read: false,
        createdAt: new Date().toISOString(),
      });
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);

      addNotification({
        id: 'pwa-installed',
        type: 'system',
        title: 'App Installed!',
        message: 'Proximity Play has been installed successfully.',
        read: false,
        createdAt: new Date().toISOString(),
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [addNotification]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addNotification({
        id: 'back-online',
        type: 'system',
        title: 'Back Online',
        message: 'You are now connected to the internet.',
        read: false,
        createdAt: new Date().toISOString(),
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      addNotification({
        id: 'gone-offline',
        type: 'system',
        title: 'Offline Mode',
        message: 'You are currently offline. Some features may be limited.',
        read: false,
        createdAt: new Date().toISOString(),
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addNotification]);

  // Service worker registration disabled for better deployment compatibility
  // Can be re-enabled later if needed for offline functionality
  useEffect(() => {
    // Unregister any existing service workers to prevent caching issues
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      });
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  };

  // Install PWA
  const installPWA = async () => {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    setIsInstallable(false);

    return outcome === 'accepted';
  };

  // Update service worker
  const updateServiceWorker = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.update();
      });
    }
  };

  // Send message to service worker
  const sendMessageToSW = (message: any) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message);
    }
  };

  // Share content
  const shareContent = async (data: {
    title?: string;
    text?: string;
    url?: string;
  }) => {
    if (navigator.share) {
      try {
        await navigator.share(data);
        return true;
      } catch (error) {
        console.log('Error sharing:', error);
        return false;
      }
    }
    return false;
  };

  // Get app version from service worker
  const getAppVersion = async () => {
    return new Promise((resolve) => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data.version);
        };
        navigator.serviceWorker.controller.postMessage(
          { type: 'GET_VERSION' },
          [messageChannel.port2]
        );
      } else {
        resolve('1.0.0');
      }
    });
  };

  return {
    isInstallable,
    isInstalled,
    isOnline,
    deferredPrompt,
    installPWA,
    requestNotificationPermission,
    updateServiceWorker,
    sendMessageToSW,
    shareContent,
    getAppVersion,
  };
};