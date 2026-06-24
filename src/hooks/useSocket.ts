import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';

interface UseSocketOptions {
  url?: string;
  enabled?: boolean;
}

export const useSocket = (options: UseSocketOptions = {}) => {
  const { enabled = false } = options;
  const { user, isAuthenticated } = useAppStore();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Stub for socket.io functionality
  // In a future phase, this will be replaced with Supabase Realtime
  
  useEffect(() => {
    if (!enabled || !isAuthenticated || !user) {
      setIsConnected(false);
      return;
    }

    // Pretend to connect for now
    setIsConnected(true);
    setConnectionError(null);

    return () => {
      setIsConnected(false);
    };
  }, [enabled, isAuthenticated, user]);

  const sendMessage = (bubbleId: string, content: string) => {
    console.log('Stub: sendMessage', { bubbleId, content });
  };

  const joinBubble = (bubbleId: string) => {
    console.log('Stub: joinBubble', { bubbleId });
  };

  const leaveBubble = (bubbleId: string) => {
    console.log('Stub: leaveBubble', { bubbleId });
  };

  const updateLocation = (location: { lat: number; lng: number }) => {
    console.log('Stub: updateLocation', { location });
  };

  const sendTyping = (bubbleId: string, isTyping: boolean) => {
    console.log('Stub: sendTyping', { bubbleId, isTyping });
  };

  return {
    socket: null,
    isConnected,
    connectionError,
    sendMessage,
    joinBubble,
    leaveBubble,
    updateLocation,
    sendTyping,
  };
};