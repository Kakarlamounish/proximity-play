import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '@/stores/useAppStore';

interface UseSocketOptions {
  url?: string;
  enabled?: boolean;
}

export const useSocket = (options: UseSocketOptions = {}) => {
  // FIX #7: default enabled to false — the Socket.IO server is not deployed;
  // callers must explicitly opt-in when the server is available.
  const { url = 'wss://api.proximity-play.com', enabled = false } = options;
  const { user, isAuthenticated } = useAppStore();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled || !isAuthenticated || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Create socket connection
    const socket = io(url, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      auth: {
        token: user.id, // In production, use proper JWT token
      },
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
      setConnectionError(null);

      // Join user's rooms
      socket.emit('join_user_room', user.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnectionError(error.message);
      setIsConnected(false);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      setConnectionError(null);
    });

    socket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
      setConnectionError(error.message);
    });

    // Message events
    socket.on('new_message', (data) => {
      console.log('New message received:', data);
      // Handle new message - could dispatch to store or emit custom event
      window.dispatchEvent(new CustomEvent('socket:new_message', { detail: data }));
    });

    socket.on('user_online', (data) => {
      console.log('User came online:', data);
      window.dispatchEvent(new CustomEvent('socket:user_online', { detail: data }));
    });

    socket.on('user_offline', (data) => {
      console.log('User went offline:', data);
      window.dispatchEvent(new CustomEvent('socket:user_offline', { detail: data }));
    });

    socket.on('location_update', (data) => {
      console.log('Location update:', data);
      window.dispatchEvent(new CustomEvent('socket:location_update', { detail: data }));
    });

    socket.on('bubble_activity', (data) => {
      console.log('Bubble activity:', data);
      window.dispatchEvent(new CustomEvent('socket:bubble_activity', { detail: data }));
    });

    // Cleanup
    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [enabled, isAuthenticated, user, url]);

  // Send message
  const sendMessage = (bubbleId: string, content: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('send_message', {
        bubbleId,
        content,
        senderId: user?.id,
        timestamp: new Date().toISOString(),
      });
    }
  };

  // Join bubble room
  const joinBubble = (bubbleId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('join_bubble', bubbleId);
    }
  };

  // Leave bubble room
  const leaveBubble = (bubbleId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('leave_bubble', bubbleId);
    }
  };

  // Update location
  const updateLocation = (location: { lat: number; lng: number }) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('update_location', {
        userId: user?.id,
        location,
        timestamp: new Date().toISOString(),
      });
    }
  };

  // Send typing indicator
  const sendTyping = (bubbleId: string, isTyping: boolean) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('typing', {
        bubbleId,
        userId: user?.id,
        isTyping,
      });
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    sendMessage,
    joinBubble,
    leaveBubble,
    updateLocation,
    sendTyping,
  };
};