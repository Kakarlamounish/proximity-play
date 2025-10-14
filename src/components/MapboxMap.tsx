import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { Button } from '@/components/ui/button';
import { Navigation as NavigationIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ExplorationBadge } from '@/components/ui/exploration-badge';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

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

// Component to handle map interactions
function MapController({ onLocationSelect }: { onLocationSelect?: (lat: number, lng: number) => void }) {
  const map = useMap();
  
  useEffect(() => {
    if (!onLocationSelect) return;
    
    const handleClick = (e: L.LeafletMouseEvent) => {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    };
    
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, onLocationSelect]);
  
  return null;
}

// Component to handle heatmap
function HeatmapLayer({ locations }: { locations: Location[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (!locations.length) return;
    
    const points: [number, number, number][] = locations.map(loc => [
      loc.latitude,
      loc.longitude,
      0.5 // intensity
    ]);
    
    const heat = (L as any).heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      max: 1.0,
      gradient: {
        0.0: 'rgba(33,196,235,0)',
        0.2: 'rgb(33,196,235)',
        0.4: 'rgb(38,242,203)',
        0.6: 'rgb(233,253,47)',
        0.8: 'rgb(255,190,11)',
        1.0: 'rgb(255,102,0)'
      }
    }).addTo(map);
    
    return () => {
      map.removeLayer(heat);
    };
  }, [map, locations]);
  
  return null;
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
  showARPins = false,
}: MapProps) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const { toast } = useToast();
  const [exploredPercentage] = useState(0.0035);
  const mapCenter: [number, number] = center ? [center[1], center[0]] : [0, 0];
  
  // Group nearby users
  const groupedUsers: { [key: string]: Location[] } = {};
  liveLocations.forEach(loc => {
    let assigned = false;
    Object.entries(groupedUsers).some(([key, group]) => {
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
      groupedUsers[`${loc.latitude},${loc.longitude}`] = [loc];
    }
  });

  // Custom icon for user groups
  const createUserIcon = (count: number, avatarUrl?: string) => {
    if (count === 1 && avatarUrl) {
      return L.divIcon({
        html: `<div class="flex items-center justify-center w-10 h-10 rounded-full border-2 border-primary shadow-lg overflow-hidden"><img src="${avatarUrl}" class="w-full h-full object-cover" /></div>`,
        className: '',
        iconSize: [40, 40],
      });
    }
    return L.divIcon({
      html: `<div class="flex items-center justify-center w-10 h-10 bg-primary text-primary-foreground rounded-full border-2 border-background shadow-lg font-bold">${count}</div>`,
      className: '',
      iconSize: [40, 40],
    });
  };

  // Custom icon for bubbles
  const bubbleIcon = L.divIcon({
    html: '<div class="flex items-center justify-center w-8 h-8 bg-cyan-500 text-white rounded-full border-2 border-background shadow-lg">🫧</div>',
    className: '',
    iconSize: [32, 32],
  });

  return (
    <div className="relative w-full h-full">
      <ExplorationBadge percentage={exploredPercentage} />
      <MapContainer
        center={mapCenter}
        zoom={center ? 12 : 2}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        <MapController onLocationSelect={onLocationSelect} />
        <HeatmapLayer locations={liveLocations} />
        
        {/* User group markers */}
        {Object.values(groupedUsers).map((groupUsers, idx) => {
          const firstUser = groupUsers[0];
          return (
            <Marker
              key={`user-group-${idx}`}
              position={[firstUser.latitude, firstUser.longitude]}
              icon={createUserIcon(groupUsers.length, groupUsers.length === 1 ? firstUser.avatar_url : undefined)}
            >
              <Popup>
                <div className="p-2 bg-card text-card-foreground rounded-lg">
                  {groupUsers.map((user, userIdx) => (
                    <div key={userIdx} className="mb-2 last:mb-0">
                      <p className="font-semibold text-foreground">{user.user_name || 'User'}</p>
                      {user.status && <p className="text-sm text-muted-foreground">{user.status}</p>}
                    </div>
                  ))}
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        {/* Bubble markers */}
        {showBubbles && bubbles.map((bubble) => (
          <Marker
            key={bubble.id}
            position={[bubble.latitude, bubble.longitude]}
            icon={bubbleIcon}
          >
            <Popup>
              <div className="p-2 bg-card text-card-foreground rounded-lg">
                <h3 className="font-bold text-foreground">{bubble.name}</h3>
                <p className="text-sm text-muted-foreground">{bubble.interest_tag}</p>
                <p className="text-xs text-muted-foreground">{bubble.member_count} members</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm p-4 rounded-lg shadow-lg z-[1000]">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
            <span>Bubble</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary"></div>
            <span>Users</span>
          </div>
        </div>
      </div>
    </div>
  );
}