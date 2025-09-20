import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Users, Navigation as NavigationIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface MapProps {
  bubbles?: any[];
  showBubbles?: boolean;
  center?: [number, number];
  onLocationSelect?: (lat: number, lng: number) => void;
  liveLocations?: any[];
  currentUserId?: string;
}

const Map: React.FC<MapProps> = ({ 
  bubbles = [], 
  showBubbles = true, 
  center,
  onLocationSelect,
  liveLocations = [],
  currentUserId
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [needsToken, setNeedsToken] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const initializeMap = async () => {
      if (!mapContainer.current) return;
      let token = mapboxToken;
      if (!token) {
        setNeedsToken(true);
        return;
      }
      try {
        mapboxgl.accessToken = token;
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/light-v11',
          center: center || [0, 0],
          zoom: center ? 12 : 2,
          pitch: 0,
        });
        map.current.addControl(
          new mapboxgl.NavigationControl({ visualizePitch: true }),
          'top-right'
        );
        // Add click handler for location selection
        if (onLocationSelect) {
          map.current.on('click', (e) => {
            const { lng, lat } = e.lngLat;
            onLocationSelect(lat, lng);
            new mapboxgl.Marker({ color: '#ef4444' })
              .setLngLat([lng, lat])
              .addTo(map.current!);
          });
        }
      } catch (error) {
        console.error('Error initializing map:', error);
        toast({
          title: 'Map Error',
          description: 'Failed to load map. Please check your Mapbox token.',
          variant: 'destructive',
        });
      }
    };
    if (mapboxToken && !needsToken) {
      initializeMap();
    }
    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, needsToken, center, onLocationSelect]);

  // Add/refresh markers for bubbles and live locations
  useEffect(() => {
    if (!map.current) return;
    // Remove all existing markers except mapbox controls
    const mapInstance = map.current;
    // Remove previous markers by tracking them
    if ((mapInstance as any)._customMarkers) {
      (mapInstance as any)._customMarkers.forEach((m: any) => m.remove());
    }
    (mapInstance as any)._customMarkers = [];

    // Show bubble markers
    if (showBubbles && bubbles.length > 0) {
      bubbles.forEach((bubble) => {
        const marker = new mapboxgl.Marker({ color: '#06b6d4' })
          .setLngLat([bubble.longitude, bubble.latitude])
          .setPopup(
            new mapboxgl.Popup().setHTML(`
              <div class="p-2">
                <h3 class="font-bold">${bubble.name}</h3>
                <p class="text-sm text-gray-600">${bubble.interest_tag}</p>
                <p class="text-xs">${bubble.member_count} members</p>
              </div>
            `)
          )
          .addTo(mapInstance);
        (mapInstance as any)._customMarkers.push(marker);
      });
    }

    // Show live user locations with profile avatars and details
    if (liveLocations && liveLocations.length > 0) {
      liveLocations.forEach((loc) => {
        const isCurrentUser = loc.user_id === currentUserId;
        // Use avatar if available, fallback to initials
        const avatarUrl = loc.avatar_url || '';
        const initials = loc.user_name ? loc.user_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U';
        const popupHtml = `
          <div class="p-2 flex items-center gap-2">
            <div class="w-10 h-10 rounded-full overflow-hidden border border-gray-300 bg-gray-100 flex items-center justify-center">
              ${avatarUrl ? `<img src='${avatarUrl}' alt='avatar' class='w-full h-full object-cover' />` : `<span class='font-bold text-lg'>${initials}</span>`}
            </div>
            <div>
              <h3 class="font-bold">${isCurrentUser ? 'You' : (loc.user_name || 'User')}</h3>
              ${loc.status ? `<p class='text-xs text-blue-600'>${loc.status}</p>` : ''}
              <p class="text-xs text-gray-500">${new Date(loc.updated_at).toLocaleTimeString()}</p>
            </div>
          </div>
        `;
        const marker = new mapboxgl.Marker({ color: isCurrentUser ? '#8b5cf6' : '#22c55e' })
          .setLngLat([loc.longitude, loc.latitude])
          .setPopup(new mapboxgl.Popup().setHTML(popupHtml))
          .addTo(mapInstance);
        (mapInstance as any)._customMarkers.push(marker);
      });
    }
  }, [bubbles, showBubbles, liveLocations, currentUserId]);

  const handleTokenSubmit = () => {
    if (mapboxToken.trim()) {
      setNeedsToken(false);
    }
  };

  if (needsToken) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Setup Mapbox
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            To use the map feature, please enter your Mapbox public token. 
            You can get one for free at{' '}
            <a href="https://mapbox.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              mapbox.com
            </a>
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Enter your Mapbox public token"
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
              type="password"
            />
            <Button onClick={handleTokenSubmit}>
              Load Map
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative w-full h-[400px] rounded-lg overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Map Legend */}
      <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span>Your Location</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Other Users</span>
          </div>
          {showBubbles && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
              <span>Bubbles</span>
            </div>
          )}
          {onLocationSelect && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>Selected Location</span>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Location Toggle */}
      {showBubbles && (
        <div className="absolute bottom-4 right-4">
          <Button
            size="sm"
            className="bg-card/90 backdrop-blur-sm hover:bg-card"
            onClick={() => {
              if (userLocation && map.current) {
                map.current.flyTo({
                  center: userLocation,
                  zoom: 14
                });
              }
            }}
          >
            <NavigationIcon className="h-4 w-4 mr-2" />
            Center on Me
          </Button>
        </div>
      )}
    </div>
  );
};

export default Map;