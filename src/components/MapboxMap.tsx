import React, { useEffect, useRef, useState } from 'react';
import mapboxgl, { Map as MapGL } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Navigation as NavigationIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ExplorationBadge } from '@/components/ui/exploration-badge';
import { UserMarker } from '@/components/user-marker';
import ReactDOM from 'react-dom';
import { mapStyle, heatmapLayer } from '@/components/map-style';

interface Location {
  user_id: string;
  latitude: number;
  longitude: number;
  avatar_url?: string;
  user_name?: string;
  status?: string;
  updated_at: string;
}

interface MapProps {
  bubbles?: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    interest_tag: string;
    member_count: number;
  }>;
  showBubbles?: boolean;
  center?: [number, number];
  onLocationSelect?: (lat: number, lng: number) => void;
  liveLocations?: Location[];
  currentUserId?: string;
  showStories?: boolean;
  storyRadius?: number;
  showARPins?: boolean;
}

export function Map({
  bubbles = [],
  showBubbles = true,
  center,
  onLocationSelect,
  liveLocations = [],
  currentUserId,
  showStories = true,
  storyRadius = 1000,
  showARPins = false
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapGL | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapboxToken, setMapboxToken] = useState('');
  const [needsToken, setNeedsToken] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const { toast } = useToast();
  const [exploredPercentage] = useState(0.0035);

  const clearMarkers = () => {
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    try {
      mapboxgl.accessToken = mapboxToken;
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        ...mapStyle,
        center: center || [0, 0],
        zoom: center ? 12 : 2,
        pitch: 0,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: true }),
        'top-right'
      );

      if (onLocationSelect) {
        map.current.on('click', (e) => {
          const { lng, lat } = e.lngLat;
          onLocationSelect(lat, lng);
          const marker = new mapboxgl.Marker({ color: '#ef4444' })
            .setLngLat([lng, lat])
            .addTo(map.current!);
          markersRef.current.push(marker);
        });
      }

      return () => {
        map.current?.remove();
      };
    } catch (error) {
      console.error('Error initializing map:', error);
      toast({
        title: 'Map Error',
        description: 'Failed to load map. Please check your Mapbox token.',
        variant: 'destructive',
      });
    }
  }, [mapboxToken, center, onLocationSelect]);

  // Update markers and heat map
  useEffect(() => {
    if (!map.current) return;
    clearMarkers();

    // Add heat map layer
    const points = liveLocations.map(loc => ({
      type: 'Feature' as const,
      properties: {
        magnitude: 1
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [loc.longitude, loc.latitude]
      }
    }));

    if (!map.current.getSource('locations')) {
      map.current.addSource('locations', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: points
        }
      });
      map.current.addLayer({
        id: 'location-heat',
        type: 'heatmap',
        source: 'locations',
        maxzoom: 15,
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'magnitude'],
            0, 0,
            6, 1
          ],
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 1,
            15, 3
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(33,196,235,0)',
            0.2, 'rgb(33,196,235)',
            0.4, 'rgb(38,242,203)',
            0.6, 'rgb(233,253,47)',
            0.8, 'rgb(255,190,11)',
            1, 'rgb(255,102,0)'
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 2,
            9, 20
          ],
          'heatmap-opacity': 0.8
        }
      } as any);
    } else {
      (map.current.getSource('locations') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: points
      });
    }

    // Group nearby users
    const groups: { [key: string]: Location[] } = {};
    liveLocations.forEach(loc => {
      let assigned = false;
      Object.entries(groups).some(([key, group]) => {
        const [groupLat, groupLng] = key.split(',').map(Number);
        const distance = Math.sqrt(
          Math.pow(loc.latitude - groupLat, 2) + 
          Math.pow(loc.longitude - groupLng, 2)
        );
        if (distance < 0.01) { // ~1km radius
          group.push(loc);
          assigned = true;
          return true;
        }
        return false;
      });
      if (!assigned) {
        groups[`${loc.latitude},${loc.longitude}`] = [loc];
      }
    });

    // Create markers for each group
    Object.values(groups).forEach(groupUsers => {
      const firstUser = groupUsers[0];
      const el = document.createElement('div');
      ReactDOM.render(
        <UserMarker users={groupUsers} />,
        el
      );
      
      const marker = new mapboxgl.Marker(el)
        .setLngLat([firstUser.longitude, firstUser.latitude])
        .addTo(map.current!);
      markersRef.current.push(marker);
    });

    // Add bubble markers
    if (showBubbles) {
      bubbles.forEach(bubble => {
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
          .addTo(map.current);
        markersRef.current.push(marker);
      });
    }
  }, [bubbles, showBubbles, liveLocations]);

  const handleTokenSubmit = () => {
    if (mapboxToken.trim()) {
      setNeedsToken(false);
    }
  };

  if (needsToken) {
    return (
      <Card className="w-[350px] mx-auto mt-8">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <Input
              placeholder="Enter your Mapbox token"
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
            />
            <Button onClick={handleTokenSubmit}>
              Set Token
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative w-full h-full">
      <ExplorationBadge percentage={exploredPercentage} />
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm p-4 rounded-lg shadow-lg">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
            <span>Bubble</span>
          </div>
          {onLocationSelect && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>Selected Location</span>
            </div>
          )}
        </div>
      </div>

      {/* Center on user button */}
      {userLocation && (
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
}