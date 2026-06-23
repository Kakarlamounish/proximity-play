import { useEffect, useCallback } from 'react';
import { useGeofenceStore } from '../stores/useGeofenceStore';
import { useAppStore } from '../stores/useAppStore';

// Calculate distance between two points in meters using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function useGeofencing() {
  const geofences = useGeofenceStore((state) => state.geofences);
  const userLocation = useAppStore((state) => state.userLocation);
  const friends = useAppStore((state) => state.friends);
  const addNotification = useAppStore((state) => state.addNotification);

  const checkGeofences = useCallback(() => {
    if (!userLocation) return;

    geofences.forEach((geofence) => {
      // Check if user entered/left geofence
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        geofence.latitude,
        geofence.longitude
      );

      const isInside = distance <= geofence.radius;
      
      // You can track previous state to determine enter/leave events
      // For now, we'll just notify if inside and alertOnEnter is true
      if (isInside && geofence.alertOnEnter) {
        addNotification({
          id: crypto.randomUUID(),
          type: 'info',
          title: 'Geofence Alert',
          message: `You entered ${geofence.name}`,
          timestamp: new Date(),
        });
      }

      // Check friends' locations against geofences
      friends.forEach((friend) => {
        if (friend.location) {
          const friendDistance = calculateDistance(
            friend.location.latitude,
            friend.location.longitude,
            geofence.latitude,
            geofence.longitude
          );

          const friendIsInside = friendDistance <= geofence.radius;

          if (friendIsInside && geofence.friendId === friend.id && geofence.alertOnEnter) {
            addNotification({
              id: crypto.randomUUID(),
              type: 'success',
              title: 'Friend Alert',
              message: `${friend.name} entered ${geofence.name}`,
              timestamp: new Date(),
            });
          }
        }
      });
    });
  }, [geofences, userLocation, friends, addNotification]);

  useEffect(() => {
    const interval = setInterval(checkGeofences, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [checkGeofences]);

  return { checkGeofences };
}
