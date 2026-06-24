import { useEffect } from 'react';

interface HapticOptions {
  pattern?: number | number[];
  type?: 'success' | 'warning' | 'error' | 'light' | 'medium' | 'heavy';
}

export const useHapticFeedback = () => {
  const trigger = (options: HapticOptions = {}) => {
    const { pattern, type } = options;

    if (!('vibrate' in navigator)) {
      console.warn('Haptic feedback not supported on this device');
      return;
    }

    let vibrationPattern: number | number[] = [10]; // Default light tap

    if (pattern) {
      vibrationPattern = pattern;
    } else if (type) {
      switch (type) {
        case 'success':
          vibrationPattern = [50, 50, 50]; // Three short bursts
          break;
        case 'warning':
          vibrationPattern = [100, 50, 100]; // Two medium bursts
          break;
        case 'error':
          vibrationPattern = [200, 50, 200, 50, 200]; // Three long bursts
          break;
        case 'light':
          vibrationPattern = [10];
          break;
        case 'medium':
          vibrationPattern = [50];
          break;
        case 'heavy':
          vibrationPattern = [100];
          break;
      }
    }

    navigator.vibrate(vibrationPattern);
  };

  const success = () => trigger({ type: 'success' });
  const warning = () => trigger({ type: 'warning' });
  const error = () => trigger({ type: 'error' });
  const light = () => trigger({ type: 'light' });
  const medium = () => trigger({ type: 'medium' });
  const heavy = () => trigger({ type: 'heavy' });

  return { trigger, success, warning, error, light, medium, heavy };
};

// Hook for automatic haptic on specific events
export const useHapticOnEvent = (
  eventTrigger: any,
  eventType: 'success' | 'warning' | 'error' | 'light' | 'medium' | 'heavy' = 'light'
) => {
  const { trigger } = useHapticFeedback();

  useEffect(() => {
    if (eventTrigger) {
      trigger({ type: eventType });
    }
  }, [eventTrigger, eventType, trigger]);
};

// Helper for common patterns
export const hapticPatterns = {
  geofenceEnter: [30, 50, 30], // Double pulse
  messageReceived: [20, 30, 20], // Quick triple tap
  friendNearby: [50, 100, 50], // Alert pattern
  callIncoming: [100, 50, 100, 50, 100], // Ringing simulation
  buttonPress: [10], // Light tap
  longPress: [50], // Medium confirmation
};
