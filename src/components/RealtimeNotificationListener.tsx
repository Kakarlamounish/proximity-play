import React from 'react';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { useAuth } from '@/contexts/AuthContext';

export const RealtimeNotificationListener: React.FC = () => {
  const { user } = useAuth();
  
  // Only activate when user is logged in
  useRealtimeNotifications({
    onNewMessage: (message) => {
      console.log('New message received:', message);
    },
    onBubbleJoin: (membership) => {
      console.log('New member joined:', membership);
    },
    onNewNotification: (notification) => {
      console.log('New notification:', notification);
    },
  });

  return null; // This component doesn't render anything
};
