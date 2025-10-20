// Emoji Reaction Picker and Map Drop
const EMOJI_OPTIONS = ['😀','👍','🔥','🎉','❤️','😂','😮','😢','😎','🙏'];
function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div
      style={{ position: 'absolute', top: 120, right: 32, zIndex: 2000, background: 'rgba(30,41,59,0.97)', borderRadius: 8, boxShadow: '0 2px 8px #6366f1', padding: '8px 12px', display: 'flex', gap: 8 }}
      role="toolbar"
      aria-label="Emoji reaction picker"
    >
      {EMOJI_OPTIONS.map(e => (
        <button
          key={e}
          onClick={() => onPick(e)}
          style={{ fontSize: 24, background: 'none', border: 'none', cursor: 'pointer' }}
          aria-label={`React with ${e}`}
          type="button"
        >
          {e}
        </button>
      ))}
    </div>
  );
}
// Nearby Places Search Bar
function NearbyPlacesSearch({
  mapCenter,
  nearbyPlaces,
  setNearbyPlaces
}: {
  mapCenter: [number, number];
  nearbyPlaces: any[];
  setNearbyPlaces: (places: any[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&viewbox=${mapCenter[1]-0.05},${mapCenter[0]-0.05},${mapCenter[1]+0.05},${mapCenter[0]+0.05}`;
    const res = await fetch(url);
    const data = await res.json();
    setNearbyPlaces(data);
    setLoading(false);
  };

  return (
    <div
      style={{ position: 'absolute', top: 72, left: 32, zIndex: 2000, background: 'rgba(30,41,59,0.97)', borderRadius: 8, boxShadow: '0 2px 8px #6366f1', padding: '12px 16px', minWidth: 320 }}
      role="search"
      aria-label="Nearby places search"
    >
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search nearby (e.g. cafe, restaurant)"
          style={{ flex: 1, padding: 8, borderRadius: 6, border: 'none', background: '#334155', color: '#fff' }}
          aria-label="Search query"
        />
        <button
          type="submit"
          style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer' }}
          aria-label={loading ? 'Searching for places' : 'Search for places'}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>
      {nearbyPlaces.length > 0 && (
        <div style={{ marginTop: 12, maxHeight: 180, overflowY: 'auto' }} role="list" aria-label="Search results">
          {nearbyPlaces.map((place, idx) => (
            <div
              key={idx}
              style={{ marginBottom: 8, background: '#475569', borderRadius: 6, padding: 8, color: '#fff', cursor: 'pointer' }}
              role="listitem"
              aria-label={`Place: ${place.display_name}, Type: ${place.type}`}
            >
              <strong>{place.display_name}</strong>
              <div style={{ fontSize: 12, color: '#a3a3a3' }}>{place.type}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// Map Theme Switcher
const MAP_THEMES = [
  { key: 'standard', label: 'Standard', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors' },
  { key: 'dark', label: 'Dark', url: 'https://tiles.stadiamaps.com/tiles/alidade_dark/{z}/{x}/{y}{r}.png', attribution: '&copy; Stadia Maps, OpenMapTiles, OpenStreetMap contributors' },
  { key: 'satellite', label: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR, and the GIS User Community' }
];

function MapThemeSwitcher({ theme, setTheme }: { theme: string; setTheme: (theme: string) => void }) {
  return (
    <div
      style={{ position: 'absolute', top: 24, left: 32, zIndex: 2000, display: 'flex', gap: 8 }}
      role="radiogroup"
      aria-label="Map theme selector"
    >
      {MAP_THEMES.map(t => (
        <button
          key={t.key}
          onClick={() => setTheme(t.key)}
          style={{
            background: theme === t.key ? 'linear-gradient(90deg,#6366f1,#3b82f6)' : '#334155',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 14px',
            fontWeight: 'bold',
            fontSize: 14,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            outline: 'none',
            marginRight: 4,
          }}
          role="radio"
          aria-checked={theme === t.key}
          aria-label={`Switch to ${t.label} map theme`}
          type="button"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
// Named export already provided by 'export function Map'.
// Live Location Sharing Toggle Button
const LocationSharingToggle: React.FC<{ enabled: boolean; onToggle: () => void }> = ({ enabled, onToggle }) => (
  <div style={{ position: 'absolute', top: 24, right: 32, zIndex: 2000 }}>
    <button
      onClick={onToggle}
      style={{
        background: enabled ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#64748b,#334155)',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        padding: '10px 18px',
        fontWeight: 'bold',
        fontSize: 15,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        cursor: 'pointer',
        outline: 'none',
      }}
      title={enabled ? 'Disable Live Location Sharing' : 'Enable Live Location Sharing'}
      aria-label={enabled ? 'Location sharing is enabled. Click to disable.' : 'Location sharing is disabled. Click to enable.'}
      aria-pressed={enabled}
      type="button"
    >
      {enabled ? '🟢 Sharing Location' : '🔴 Not Sharing'}
    </button>
  </div>
);
// Custom control for heatmap stats
const HeatmapStatsControl: React.FC<{ locations: { latitude: number; longitude: number }[] }> = ({ locations }) => {
  const map = useMap();
  useEffect(() => {
    // Example: count hotspots (clusters of users within 100m)
    const hotspots = locations.length;
    const controlDiv = document.createElement('div');
    controlDiv.style.background = 'rgba(30,41,59,0.85)';
    controlDiv.style.color = '#fff';
    controlDiv.style.padding = '8px 16px';
    controlDiv.style.borderRadius = '8px';
    controlDiv.style.fontWeight = 'bold';
    controlDiv.style.fontSize = '14px';
    controlDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    controlDiv.innerText = `Hotspots: ${hotspots}`;
    controlDiv.setAttribute('aria-label', `Map statistics: ${hotspots} hotspots detected`);
    controlDiv.setAttribute('role', 'status');
    const customControl = (window as any).L.control({ position: 'topright' });
    customControl.onAdd = () => controlDiv;
    customControl.addTo(map);
    return () => { customControl.remove(); };
  }, [locations, map]);
  return null;
};
// --- Live User Presence ---
const LiveUserList: React.FC<{ users: { id: string; name: string; online: boolean; location?: [number, number] }[] }> = ({ users }) => (
  <div style={{ position: 'absolute', left: 24, top: 24, zIndex: 2000, minWidth: 220, background: 'rgba(30,41,59,0.97)', borderRadius: 8, boxShadow: '0 2px 8px #6366f1', padding: '12px 16px' }}>
    <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: 8 }}>🟢 Live Users</div>
    {users.map(u => (
      <div key={u.id} style={{ color: u.online ? '#22c55e' : '#64748b', marginBottom: 6 }}>
        <span style={{ fontWeight: 'bold' }}>{u.name}</span>
        {u.location && <span style={{ fontSize: 12, marginLeft: 8 }}>({u.location[0].toFixed(3)}, {u.location[1].toFixed(3)})</span>}
        {u.online ? ' • Online' : ' • Offline'}
      </div>
    ))}
  </div>
);

// --- Live Activity Feed ---
const ActivityFeed: React.FC<{ events: { id: string; type: string; user: string; detail: string; time: string }[] }> = ({ events }) => (
  <div style={{ position: 'absolute', left: 24, bottom: 24, zIndex: 2000, minWidth: 320, background: 'rgba(30,41,59,0.97)', borderRadius: 8, boxShadow: '0 2px 8px #6366f1', padding: '12px 16px', maxHeight: 180, overflowY: 'auto' }}>
    <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: 8 }}>⚡ Activity Feed</div>
    {events.map(e => (
      <div key={e.id} style={{ color: '#fff', marginBottom: 6 }}>
        <span style={{ color: '#6366f1', fontWeight: 'bold' }}>{e.user}</span>
        <span style={{ marginLeft: 8 }}>{e.type === 'join' ? 'joined' : e.type === 'message' ? 'messaged' : e.type}</span>
        <span style={{ marginLeft: 8, color: '#94a3b8', fontSize: 13 }}>{e.detail}</span>
        <span style={{ float: 'right', color: '#94a3b8', fontSize: 12 }}>{e.time}</span>
      </div>
    ))}
  </div>
);
// (imports removed; use main import block below)
// Floating Action Button for quick map actions using React-Leaflet context
const FloatingActionButton: React.FC<{ latlng?: [number, number]; icon?: string; label?: string }> = ({ latlng, icon = '📍', label = 'Center on Me' }) => {
  const map = useMap();
  return (
    <div style={{ position: 'absolute', bottom: 32, right: 32, zIndex: 1000 }}>
      <button
        onClick={() => {
          if (latlng) {
            map.setView(latlng, 15);
          }
        }}
        style={{
          background: 'linear-gradient(90deg,#6366f1,#3b82f6)',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: 56,
          height: 56,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          fontSize: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          outline: 'none',
        }}
        title={label}
      >
        {icon}
      </button>
    </div>
  );
}
// Utility to calculate average distance between all pairs of locations
function getAverageDistance(locations: { latitude: number; longitude: number }[]): number {
  if (locations.length < 2) return 0;
  let total = 0;
  let count = 0;
  for (let i = 0; i < locations.length; i++) {
    for (let j = i + 1; j < locations.length; j++) {
      const R = 6371000;
      const dLat = (locations[j].latitude - locations[i].latitude) * Math.PI / 180;
      const dLon = (locations[j].longitude - locations[i].longitude) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(locations[i].latitude * Math.PI / 180) * Math.cos(locations[j].latitude * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      total += R * c;
      count++;
    }
  }
  return count ? total / count : 0;
}
// Custom control for average distance
const AvgDistanceControl: React.FC<{ locations: { latitude: number; longitude: number }[] }> = ({ locations }) => {
  const map = useMap();
  React.useEffect(() => {
    const avgDist = getAverageDistance(locations);
    const controlDiv = document.createElement('div');
    controlDiv.style.background = 'rgba(30,41,59,0.85)';
    controlDiv.style.color = '#fff';
    controlDiv.style.padding = '8px 16px';
    controlDiv.style.borderRadius = '8px';
    controlDiv.style.fontWeight = 'bold';
    controlDiv.style.fontSize = '14px';
    controlDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    controlDiv.innerText = `Avg Distance: ${avgDist > 1000 ? (avgDist/1000).toFixed(2) + ' km' : avgDist.toFixed(0) + ' m'}`;
    const customControl = (window as any).L.control({ position: 'topright' });
    customControl.onAdd = () => controlDiv;
    customControl.addTo(map);
    return () => {
      customControl.remove();
    };
  }, [locations, map]);
  return null;
};
// Custom user count control
const UserCountControl: React.FC<{ count: number }> = ({ count }) => {
  const map = useMap();
  React.useEffect(() => {
    const controlDiv = document.createElement('div');
    controlDiv.style.background = 'rgba(30,41,59,0.85)';
    controlDiv.style.color = '#fff';
    controlDiv.style.padding = '8px 16px';
    controlDiv.style.borderRadius = '8px';
    controlDiv.style.fontWeight = 'bold';
    controlDiv.style.fontSize = '14px';
    controlDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    controlDiv.innerText = `Live Users: ${count}`;
    const customControl = (window as any).L.control({ position: 'topright' });
    customControl.onAdd = () => controlDiv;
    customControl.addTo(map);
    return () => {
      customControl.remove();
    };
  }, [count, map]);
  return null;
};
import { useMapEvents } from 'react-leaflet';
// Demo map event handler component
const MapEvents: React.FC<{ onClick?: (e: any) => void }> = ({ onClick }) => {
  useMapEvents({
    click: (e) => {
      if (onClick) onClick(e);
      console.log('Map clicked at:', e.latlng);
    },
    moveend: (e) => {
      console.log('Map moved. Center:', e.target.getCenter());
    },
    zoomend: (e) => {
      console.log('Map zoomed. Zoom level:', e.target.getZoom());
    },
  });
  return null;
};
// Routing component using OSRM API
const Routing: React.FC<{ start: [number, number]; end: [number, number] }> = ({ start, end }) => {
  const [routeCoords, setRouteCoords] = React.useState<[number, number][]>([]);
  const map = useMap();
  React.useEffect(() => {
    const fetchRoute = async () => {
      const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
        setRouteCoords(coords);
      }
    };
    fetchRoute();
  }, [start, end]);
  return routeCoords.length > 0 ? (
    <Polyline positions={routeCoords} pathOptions={{ color: 'green', weight: 5 }} />
  ) : null;
};
import React, { useRef, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';
// (already imported above)
// Supabase client for real-time features
// import { createClient } from '@supabase/supabase-js';
// --- Notification System Skeleton ---
const NotificationCenter: React.FC<{ notifications: { id: string; message: string; time: string }[] }> = ({ notifications }) => (
  <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 2000, minWidth: 320 }}>
    {notifications.map(n => (
      <div key={n.id} style={{ background: '#1e293b', color: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #6366f1', marginBottom: 8, padding: '12px 16px', fontSize: 15 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>🔔 {n.message}</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{n.time}</div>
      </div>
    ))}
  </div>
);

// --- Chat Sidebar Skeleton ---
const ChatSidebar: React.FC<{ messages: { id: string; user: string; text: string; time: string }[] }> = ({ messages }) => (
  <div style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: 320, background: 'rgba(30,41,59,0.97)', zIndex: 2000, boxShadow: '-2px 0 12px #6366f1', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '16px', borderBottom: '1px solid #334155', fontWeight: 'bold', color: '#fff' }}>💬 Live Chat</div>
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
      {messages.map(m => (
        <div key={m.id} style={{ marginBottom: 12 }}>
          <span style={{ color: '#6366f1', fontWeight: 'bold' }}>{m.user}</span>
          <span style={{ color: '#fff', marginLeft: 8 }}>{m.text}</span>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{m.time}</div>
        </div>
      ))}
    </div>
    <div style={{ padding: '12px', borderTop: '1px solid #334155' }}>
      <input type="text" placeholder="Type a message..." style={{ width: '100%', padding: 8, borderRadius: 6, border: 'none', background: '#334155', color: '#fff' }} />
    </div>
  </div>
);
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Navigation as NavigationIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ExplorationBadge } from '@/components/ui/exploration-badge';
import { UserMarker } from '@/components/user-marker';
import { createRoot } from 'react-dom/client';
import { mapStyle } from '@/components/map-style';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Tooltip } from 'react-leaflet';
import { Polyline, Polygon } from 'react-leaflet';
import { LayersControl } from 'react-leaflet';
import { ScaleControl } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import { useMap } from 'react-leaflet';
// Custom Geosearch component
const Geosearch: React.FC = () => {
  const map = useMap();
  React.useEffect(() => {
    const provider = new OpenStreetMapProvider();
    const searchControl = new GeoSearchControl({
      provider,
      style: 'bar',
      showMarker: true,
      showPopup: true,
      marker: {
        icon: '📍',
        draggable: false,
      },
      popupFormat: ({ query, result }) => `${result.label}`,
      maxMarkers: 1,
      retainZoomLevel: false,
      animateZoom: true,
      autoClose: true,
      keepResult: true,
    });
    map.addControl(searchControl);
    return () => {
      map.removeControl(searchControl);
    };
  }, [map]);
  return null;
};
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet.heat';
// Plugin imports
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet-minimap/dist/Control.MiniMap.min.css';
import 'leaflet-minimap/dist/Control.MiniMap.min.js';
import 'leaflet-measure/dist/leaflet-measure.css';
import 'leaflet-measure/dist/leaflet-measure.js';
import 'leaflet-easyprint';
// (already imported above)

// Custom MiniMap control
export const MiniMapControl: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const tileLayer = new L.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    const miniMap = new (window as any).L.Control.MiniMap(tileLayer, { toggleDisplay: true }).addTo(map);
    return () => { miniMap.remove(); };
  }, [map]);
  return null;
};

// Custom Measurement control
export const MeasureControl: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const measureControl = new (window as any).L.Control.Measure({
      position: 'topright',
      primaryLengthUnit: 'meters',
      secondaryLengthUnit: 'kilometers',
      primaryAreaUnit: 'sqmeters',
      secondaryAreaUnit: 'hectares',
    });
    measureControl.addTo(map);
  return () => { measureControl.remove(); };
  }, [map]);
  return null;
};

// Custom clustered markers
export const ClusteredMarkers: React.FC<{ locations: { latitude: number; longitude: number; name?: string }[] }> = ({ locations }) => {
  const map = useMap();
  useEffect(() => {
    const markers = locations.map(loc => L.marker([loc.latitude, loc.longitude], {
      icon: L.icon({
        iconUrl: '/public/placeholder.svg',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      })
    }).bindPopup(loc.name || 'User'));
    const markerCluster = (window as any).L.markerClusterGroup();
    markers.forEach(m => markerCluster.addLayer(m));
    map.addLayer(markerCluster);
    return () => { map.removeLayer(markerCluster); };
  }, [locations, map]);
  return null;
};
// Plugin imports
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet-minimap/dist/Control.MiniMap.min.css';
import 'leaflet-minimap/dist/Control.MiniMap.min.js';
import 'leaflet-measure/dist/leaflet-measure.css';
import 'leaflet-measure/dist/leaflet-measure.js';

// Custom HeatmapLayer component
const HeatmapLayer: React.FC<{ points: [number, number, number?][] }> = ({ points }) => {
  const map = useMap();
  React.useEffect(() => {
    // Remove previous heat layer if exists
    const prevLayer = (map as any)._heatLayer;
    if (prevLayer) {
      map.removeLayer(prevLayer);
    }
    // Add new heat layer
    if (points.length > 0) {
      const heatLayer = (window as any).L.heatLayer(points, { radius: 25, blur: 15, maxZoom: 17 });
      heatLayer.addTo(map);
      (map as any)._heatLayer = heatLayer;
    }
    // Cleanup
    return () => {
      const prev = (map as any)._heatLayer;
      if (prev) map.removeLayer(prev);
    };
  }, [points, map]);
  return null;
};
  // Demo route (polyline) and zone (polygon)
  const demoRoute: [number, number][] = [
    [17.385, 78.4867],
    [17.387, 78.488],
    [17.389, 78.489],
    [17.391, 78.490],
  ];
  const demoZone: [number, number][] = [
    [17.384, 78.485],
    [17.384, 78.491],
    [17.392, 78.491],
    [17.392, 78.485],
  ];
import L, { DivIcon } from 'leaflet';
import { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Location {
  user_id: string;
  latitude: number;
  longitude: number;
  avatar_url?: string;
  user_name?: string;
  profile_photo_url?: string;
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

export function Map(props: MapProps) {
  // ...existing code...
  // ...existing code...
  // Props destructuring
  const {
  bubbles = [],
  showBubbles = false,
  center = [17.385, 78.4867],
  liveLocations = [],
  currentUserId,
  showARPins = false,
  showStories = false,
  storyRadius = 1000,
  } = props;
  // Center map on first live location if available
  const mapCenter: [number, number] = liveLocations.length > 0
    ? [liveLocations[0].latitude, liveLocations[0].longitude]
    : center;

  // Weather overlay state
  const [weatherData, setWeatherData] = useState<any>(null);
  const [showWeather, setShowWeather] = useState(false);

  // Fetch weather for current map center
  useEffect(() => {
    if (!showWeather) return;
    const [lat, lon] = mapCenter;
    const apiKey = '<YOUR_OPENWEATHERMAP_API_KEY>';
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`)
      .then(res => res.json())
      .then(data => setWeatherData(data));
  }, [showWeather, mapCenter]);

  // Weather overlay tile layer URL (OpenWeatherMap clouds)
  const weatherTileUrl = 'https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=<YOUR_OPENWEATHERMAP_API_KEY>';
  // Route planning state
  const [showRouteDialog, setShowRouteDialog] = useState(false);
  const [routePoints, setRoutePoints] = useState({ start: null, end: null });
  const [routeReady, setRouteReady] = useState(false);

  // Handle map click for route planning
  const handleRouteMapClick = (e: any) => {
    if (showRouteDialog) {
      if (!routePoints.start) {
        setRoutePoints(p => ({ ...p, start: [e.latlng.lat, e.latlng.lng] }));
      } else if (!routePoints.end) {
        setRoutePoints(p => ({ ...p, end: [e.latlng.lat, e.latlng.lng] }));
        setRouteReady(true);
      }
    }
  };

  // Reset route dialog
  const handleResetRoute = () => {
    setRoutePoints({ start: null, end: null });
    setRouteReady(false);
  };

  // Event/Bubble creation state
  const [showBubbleDialog, setShowBubbleDialog] = useState(false);
  const [newBubble, setNewBubble] = useState({ name: '', interest_tag: '', member_count: 1, lat: null, lng: null });

  // Handle map click for bubble creation
  const handleMapClick = (e: any) => {
    if (showBubbleDialog) {
      setNewBubble(b => ({ ...b, lat: e.latlng.lat, lng: e.latlng.lng }));
    }
  };

  // Add new bubble to bubbles array
  const handleCreateBubble = () => {
    if (newBubble.name && newBubble.lat && newBubble.lng) {
      bubbles.push({
        id: Date.now().toString(),
        name: newBubble.name,
        interest_tag: newBubble.interest_tag,
        member_count: newBubble.member_count,
        latitude: newBubble.lat,
        longitude: newBubble.lng,
      });
      setShowBubbleDialog(false);
      setNewBubble({ name: '', interest_tag: '', member_count: 1, lat: null, lng: null });
    }
  };

  // Annotation state
  const [annotations, setAnnotations] = useState<Array<{ id: string; lat: number; lng: number; text: string }>>([]);
  const [showAnnotationDialog, setShowAnnotationDialog] = useState(false);
  const [pendingAnnotation, setPendingAnnotation] = useState<{ lat: number; lng: number } | null>(null);
  const [annotationText, setAnnotationText] = useState('');

  // Handle map click for annotation
  const handleAnnotationMapClick = (e: any) => {
    if (showAnnotationDialog) {
      setPendingAnnotation({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  };

  // Add annotation
  const handleAddAnnotation = () => {
    if (pendingAnnotation && annotationText) {
      setAnnotations(a => [...a, { id: Date.now().toString(), lat: pendingAnnotation.lat, lng: pendingAnnotation.lng, text: annotationText }]);
      setShowAnnotationDialog(false);
      setPendingAnnotation(null);
      setAnnotationText('');
    }
  };
  {/* Floating Annotation Button */}
  <div style={{ position: 'absolute', bottom: 310, right: 32, zIndex: 2000 }}>
    <button
      onClick={() => setShowAnnotationDialog(true)}
      style={{ background: 'linear-gradient(90deg,#6366f1,#f59e42)', color: '#fff', border: 'none', borderRadius: '50%', width: 56, height: 56, fontSize: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer' }}
      title="Add Annotation"
    >
      📝
    </button>
  </div>

  {/* Annotation Dialog */}
  {showAnnotationDialog && (
    <div style={{ position: 'absolute', top: 120, right: 170, zIndex: 3000, background: 'rgba(30,41,59,0.97)', borderRadius: 12, boxShadow: '0 2px 12px #6366f1', padding: '24px 32px', minWidth: 320 }}>
      <h2 style={{ color: '#fff', fontWeight: 'bold', marginBottom: 12 }}>Add Annotation</h2>
      <div style={{ color: '#a3e635', marginBottom: 10 }}>
        {pendingAnnotation ? `Location: (${pendingAnnotation.lat.toFixed(4)}, ${pendingAnnotation.lng.toFixed(4)})` : 'Click on the map to set annotation location'}
      </div>
      <input type="text" value={annotationText} onChange={e => setAnnotationText(e.target.value)} placeholder="Annotation text" style={{ width: '100%', marginBottom: 10, padding: 8, borderRadius: 6, border: 'none', background: '#334155', color: '#fff' }} />
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={handleAddAnnotation} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer' }}>Add</button>
        <button onClick={() => setShowAnnotationDialog(false)} style={{ background: '#64748b', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  )}
  {/* Listen for map clicks for annotation if dialog is open */}
  <MapEvents onClick={showAnnotationDialog ? handleAnnotationMapClick : showRouteDialog ? handleRouteMapClick : handleMapClick} />
      {annotations.map(a => (
        <Marker key={a.id} position={[a.lat, a.lng]} icon={L.divIcon({ className: '', html: `<span style='font-size:18px;background:#6366f1;color:#fff;padding:4px 8px;border-radius:6px;'>${a.text}</span>` })} />
      ))}
  // Demo live user presence and activity feed state
  const [liveUsers, setLiveUsers] = useState([
    { id: '1', name: 'Alice', online: true, location: [17.385, 78.4867] },
    { id: '2', name: 'Bob', online: true, location: [17.391, 78.490] },
    { id: '3', name: 'Charlie', online: false },
  ]);
  // Geofencing state
  const [geofences, setGeofences] = useState<Array<{ id: string; type: 'circle' | 'polygon'; center?: [number, number]; radius?: number; points?: [number, number][] }>>([]);
  const [enteredGeofences, setEnteredGeofences] = useState<{ [userId: string]: string[] }>({});

  // Geofence entry/exit detection
  useEffect(() => {
    liveUsers.forEach(user => {
      if (!user.location) return;
      geofences.forEach(fence => {
        let inside = false;
        if (fence.type === 'circle' && fence.center && fence.radius) {
          const dx = user.location[0] - fence.center[0];
          const dy = user.location[1] - fence.center[1];
          const dist = Math.sqrt(dx*dx + dy*dy) * 111000; // deg to meters
          inside = dist <= fence.radius;
        } else if (fence.type === 'polygon' && fence.points) {
          // Simple point-in-polygon
          const x = user.location[1], y = user.location[0];
          let insidePoly = false;
          for (let i = 0, j = fence.points.length - 1; i < fence.points.length; j = i++) {
            const xi = fence.points[i][1], yi = fence.points[i][0];
            const xj = fence.points[j][1], yj = fence.points[j][0];
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 0.00001) + xi);
            if (intersect) insidePoly = !insidePoly;
          }
          inside = insidePoly;
        }
        const prev = enteredGeofences[user.id] || [];
        if (inside && !prev.includes(fence.id)) {
          setEnteredGeofences(e => ({ ...e, [user.id]: [...(e[user.id] || []), fence.id] }));
          setNotifications(n => [{ id: Date.now().toString(), message: `${user.name} entered geofence`, time: new Date().toLocaleTimeString() }, ...n]);
        } else if (!inside && prev.includes(fence.id)) {
          setEnteredGeofences(e => ({ ...e, [user.id]: (e[user.id] || []).filter(id => id !== fence.id) }));
          setNotifications(n => [{ id: Date.now().toString(), message: `${user.name} exited geofence`, time: new Date().toLocaleTimeString() }, ...n]);
        }
      });
    });
  }, [liveUsers, geofences]);

  // Handle geofence drawing
  const handleGeofenceCreated = (e: any) => {
    if (e.layerType === 'circle') {
      const layer = e.layer;
      setGeofences(prev => [...prev, {
        id: Date.now().toString(),
        type: 'circle',
        center: [layer.getLatLng().lat, layer.getLatLng().lng],
        radius: layer.getRadius(),
      }]);
    } else if (e.layerType === 'polygon') {
      const layer = e.layer;
      const latlngs = layer.getLatLngs()[0].map((pt: any) => [pt.lat, pt.lng]);
      setGeofences(prev => [...prev, {
        id: Date.now().toString(),
        type: 'polygon',
        points: latlngs,
      }]);
    }
  };

      {/* Render geofences */}
      {geofences.map(fence => (
        fence.type === 'circle' ? (
          <Circle key={fence.id} center={fence.center!} radius={fence.radius!} pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.2 }} />
        ) : (
          <Polygon key={fence.id} positions={fence.points!} pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.2 }} />
        )
      ))}
  // Screenshot/Export logic
  const mapRef = useRef<any>(null);
  const handleExportMap = () => {
    if (mapRef.current) {
      const easyPrint = (window as any).L.easyPrint({
        tileLayer: mapRef.current,
        sizeModes: ['Current'],
        exportOnly: true,
        filename: `proximity-map-${Date.now()}`,
        hideControlContainer: true,
      }).addTo(mapRef.current);
      easyPrint.printMap('CurrentSize', `proximity-map-${Date.now()}`);
    }
  };
  // Add screen reader announcement for map interactions
  const announceToScreenReader = useCallback((message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';
    document.body.appendChild(announcement);
    announcement.textContent = message;
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const map = mapRef.current;
    if (!map) return;

    switch (event.key) {
      case '+':
      case '=':
        event.preventDefault();
        map.zoomIn();
        announceToScreenReader('Zoomed in on map');
        break;
      case '-':
        event.preventDefault();
        map.zoomOut();
        announceToScreenReader('Zoomed out on map');
        break;
      case 'ArrowUp':
        event.preventDefault();
        map.panBy([0, -100]);
        announceToScreenReader('Panned map up');
        break;
      case 'ArrowDown':
        event.preventDefault();
        map.panBy([0, 100]);
        announceToScreenReader('Panned map down');
        break;
      case 'ArrowLeft':
        event.preventDefault();
        map.panBy([-100, 0]);
        announceToScreenReader('Panned map left');
        break;
      case 'ArrowRight':
        event.preventDefault();
        map.panBy([100, 0]);
        announceToScreenReader('Panned map right');
        break;
      case 'Home':
        event.preventDefault();
        map.setView(mapCenter, 15);
        announceToScreenReader('Centered map on current location');
        break;
    }
  }, [mapCenter, announceToScreenReader]);

  // Add keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
  {/* Floating Screenshot/Export Button */}
  <div style={{ position: 'absolute', bottom: 240, right: 32, zIndex: 2000 }}>
    <button
      onClick={handleExportMap}
      style={{ background: 'linear-gradient(90deg,#f59e42,#fbbf24)', color: '#fff', border: 'none', borderRadius: '50%', width: 56, height: 56, fontSize: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer' }}
      title="Export Map Screenshot"
    >
      📸
    </button>
  </div>
  {/* Floating Create Event/Bubble Button */}
  <div style={{ position: 'absolute', bottom: 100, right: 32, zIndex: 2000 }}>
    <button
      onClick={() => setShowBubbleDialog(true)}
      style={{ background: 'linear-gradient(90deg,#22c55e,#16a34a)', color: '#fff', border: 'none', borderRadius: '50%', width: 56, height: 56, fontSize: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer' }}
      title="Create Event/Bubble"
    >
      ＋
    </button>
  </div>

  {/* Event/Bubble Creation Dialog */}
  {showBubbleDialog && (
    <div style={{ position: 'absolute', top: 120, right: 32, zIndex: 3000, background: 'rgba(30,41,59,0.97)', borderRadius: 12, boxShadow: '0 2px 12px #22c55e', padding: '24px 32px', minWidth: 320 }}>
      <h2 style={{ color: '#fff', fontWeight: 'bold', marginBottom: 12 }}>Create Event/Bubble</h2>
      <label style={{ color: '#fff', marginBottom: 6 }}>Name:</label>
      <input type="text" value={newBubble.name} onChange={e => setNewBubble(b => ({ ...b, name: e.target.value }))} style={{ width: '100%', marginBottom: 10, padding: 8, borderRadius: 6, border: 'none', background: '#334155', color: '#fff' }} />
      <label style={{ color: '#fff', marginBottom: 6 }}>Interest Tag:</label>
      <input type="text" value={newBubble.interest_tag} onChange={e => setNewBubble(b => ({ ...b, interest_tag: e.target.value }))} style={{ width: '100%', marginBottom: 10, padding: 8, borderRadius: 6, border: 'none', background: '#334155', color: '#fff' }} />
      <label style={{ color: '#fff', marginBottom: 6 }}>Member Count:</label>
      <input type="number" value={newBubble.member_count} min={1} onChange={e => setNewBubble(b => ({ ...b, member_count: parseInt(e.target.value) }))} style={{ width: '100%', marginBottom: 10, padding: 8, borderRadius: 6, border: 'none', background: '#334155', color: '#fff' }} />
      <div style={{ color: '#a3e635', marginBottom: 10 }}>
        {newBubble.lat && newBubble.lng ? `Location: (${newBubble.lat.toFixed(4)}, ${newBubble.lng.toFixed(4)})` : 'Click on the map to set location'}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={handleCreateBubble} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer' }}>Create</button>
        <button onClick={() => setShowBubbleDialog(false)} style={{ background: '#64748b', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  )}
  // Nearby places state
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const {
  // ...existing code...
  } = props;
  // Center map on first live location if available
  // User reactions state
  const [reactions, setReactions] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pendingEmoji, setPendingEmoji] = useState(null);
  // ...other state declarations...
  useEffect(() => {
    liveUsers.forEach(user => {
      if (!user.location) return;
      geofences.forEach(fence => {
        let inside = false;
        if (fence.type === 'circle' && fence.center && fence.radius) {
          const dx = user.location[0] - fence.center[0];
          const dy = user.location[1] - fence.center[1];
          const dist = Math.sqrt(dx*dx + dy*dy) * 111000; // deg to meters
          inside = dist <= fence.radius;
        } else if (fence.type === 'polygon' && fence.points) {
          // Simple point-in-polygon
          const x = user.location[1], y = user.location[0];
          let insidePoly = false;
          for (let i = 0, j = fence.points.length - 1; i < fence.points.length; j = i++) {
            const xi = fence.points[i][1], yi = fence.points[i][0];
            const xj = fence.points[j][1], yj = fence.points[j][0];
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 0.00001) + xi);
            if (intersect) insidePoly = !insidePoly;
          }
          inside = insidePoly;
        }
        const prev = enteredGeofences[user.id] || [];
        if (inside && !prev.includes(fence.id)) {
          setEnteredGeofences(e => ({ ...e, [user.id]: [...(e[user.id] || []), fence.id] }));
          setNotifications(n => [{ id: Date.now().toString(), message: `${user.name} entered geofence`, time: new Date().toLocaleTimeString() }, ...n]);
        } else if (!inside && prev.includes(fence.id)) {
          setEnteredGeofences(e => ({ ...e, [user.id]: (e[user.id] || []).filter(id => id !== fence.id) }));
          setNotifications(n => [{ id: Date.now().toString(), message: `${user.name} exited geofence`, time: new Date().toLocaleTimeString() }, ...n]);
        }
      });
    });
  }, [liveUsers, geofences]);
  useEffect(() => {
    liveUsers.forEach(user => {
      if (!user.location) return;
      geofences.forEach(fence => {
        let inside = false;
        if (fence.type === 'circle' && fence.center && fence.radius) {
          const dx = user.location[0] - fence.center[0];
          const dy = user.location[1] - fence.center[1];
          const dist = Math.sqrt(dx*dx + dy*dy) * 111000; // deg to meters
          inside = dist <= fence.radius;
        } else if (fence.type === 'polygon' && fence.points) {
          // Simple point-in-polygon
          const x = user.location[1], y = user.location[0];
          let insidePoly = false;
          for (let i = 0, j = fence.points.length - 1; i < fence.points.length; j = i++) {
            const xi = fence.points[i][1], yi = fence.points[i][0];
            const xj = fence.points[j][1], yj = fence.points[j][0];
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 0.00001) + xi);
            if (intersect) insidePoly = !insidePoly;
          }
          inside = insidePoly;
        }
        const prev = enteredGeofences[user.id] || [];
        if (inside && !prev.includes(fence.id)) {
          setEnteredGeofences(e => ({ ...e, [user.id]: [...(e[user.id] || []), fence.id] }));
          setNotifications(n => [{ id: Date.now().toString(), message: `${user.name} entered geofence`, time: new Date().toLocaleTimeString() }, ...n]);
        } else if (!inside && prev.includes(fence.id)) {
          setEnteredGeofences(e => ({ ...e, [user.id]: (e[user.id] || []).filter(id => id !== fence.id) }));
          setNotifications(n => [{ id: Date.now().toString(), message: `${user.name} exited geofence`, time: new Date().toLocaleTimeString() }, ...n]);
        }
      });
    });
  }, [liveUsers, geofences]);
  // Demo live user presence and activity feed state

  const [activityEvents, setActivityEvents] = useState([
    { id: '1', type: 'join', user: 'Alice', detail: '', time: '2 min ago' },
    { id: '2', type: 'message', user: 'Bob', detail: 'Hi Alice!', time: 'Just now' },
  ]);
  // Location sharing toggle state
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(false);
  // Map theme state
  const [mapTheme, setMapTheme] = useState('standard');

  // Share location to Supabase when enabled
  useEffect(() => {
    let watchId: number | null = null;
    if (locationSharingEnabled && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        pos => {
          // Send location to Supabase (pseudo-code)
          // supabase.from('user_locations').upsert({ user_id: currentUserId, lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        err => {
          // Handle error
        }
      );
    }
    return () => {
      if (watchId && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      // Optionally remove location from Supabase when disabled
      // supabase.from('user_locations').delete().eq('user_id', currentUserId);
    };
  }, [locationSharingEnabled, currentUserId]);
  // Demo notification and chat state
  // Demo notification and chat state
  const [notifications, setNotifications] = useState([
    { id: '1', message: 'Welcome to Proximity Play!', time: 'Just now' },
    { id: '2', message: 'User Alice joined the map.', time: '1 min ago' },
  ]);
  const [messages, setMessages] = useState([
    { id: '1', user: 'Alice', text: 'Hello everyone!', time: '1 min ago' },
    { id: '2', user: 'Bob', text: 'Hi Alice!', time: 'Just now' },
  ]);
  // Center map on first live location if available
  // ...existing code...

  return (
  <div
    style={{ position: 'relative', width: '100%', height: '100%', background: 'linear-gradient(120deg,#6366f1 0%,#3b82f6 100%)' }}
    role="application"
    aria-label="Interactive map with live location sharing. Use keyboard shortcuts: arrow keys to pan, +/- to zoom, Home to center."
    tabIndex={0}
    onKeyDown={(e) => {
      // Prevent default behavior for our custom shortcuts
      if (['+', '-', '=', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home'].includes(e.key)) {
        e.preventDefault();
        handleKeyDown(e.nativeEvent);
      }
    }}
  >
    {/* Floating Weather Overlay Button */}
    <div style={{ position: 'absolute', bottom: 32, left: 32, zIndex: 2000 }}>
      <button
        onClick={() => {
          setShowWeather(w => !w);
          announceToScreenReader(showWeather ? 'Weather overlay disabled' : 'Weather overlay enabled');
        }}
        style={{ background: 'linear-gradient(90deg,#38bdf8,#6366f1)', color: '#fff', border: 'none', borderRadius: '50%', width: 56, height: 56, fontSize: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer' }}
        title="Toggle Weather Overlay"
        aria-label={showWeather ? 'Disable weather overlay' : 'Enable weather overlay'}
        aria-pressed={showWeather}
        type="button"
      >
        🌦️
      </button>
    </div>

    {/* Weather Info Panel */}
    {showWeather && weatherData && (
      <div style={{ position: 'absolute', top: 24, left: 100, zIndex: 3000, background: 'rgba(30,41,59,0.97)', borderRadius: 12, boxShadow: '0 2px 12px #38bdf8', padding: '18px 28px', minWidth: 260 }}>
        <h2 style={{ color: '#fff', fontWeight: 'bold', marginBottom: 8 }}>Weather</h2>
        <div style={{ color: '#38bdf8', fontSize: 18, marginBottom: 6 }}>{weatherData.weather[0].main} ({weatherData.weather[0].description})</div>
        <div style={{ color: '#fff', fontSize: 15 }}>🌡️ Temp: {weatherData.main.temp}°C</div>
        <div style={{ color: '#fff', fontSize: 15 }}>💧 Humidity: {weatherData.main.humidity}%</div>
        <div style={{ color: '#fff', fontSize: 15 }}>🌬️ Wind: {weatherData.wind.speed} m/s</div>
      </div>
    )}
    {/* Notification Center */}
    <NotificationCenter notifications={notifications} />
    {/* Chat Sidebar */}
    <ChatSidebar messages={messages} />
    {/* Location Sharing Toggle */}
    <LocationSharingToggle
      enabled={locationSharingEnabled}
      onToggle={() => setLocationSharingEnabled(e => !e)}
    />
    {/* Map Theme Switcher */}
    <MapThemeSwitcher theme={mapTheme} setTheme={setMapTheme} />
    {/* Nearby Places Search Bar */}
  <NearbyPlacesSearch mapCenter={mapCenter} nearbyPlaces={nearbyPlaces} setNearbyPlaces={setNearbyPlaces} />
    <MapContainer
      center={mapCenter as [number, number]}
      zoom={15}
      style={{ height: '100%', width: '100%' }}
    >
      {/* Weather overlay tile layer */}
      {showWeather && (
        <TileLayer url={weatherTileUrl} opacity={0.5} />
      )}
  {/* Listen for map clicks for route planning if dialog is open */}
  <MapEvents onClick={showRouteDialog ? handleRouteMapClick : handleMapClick} />
      {routeReady && routePoints.start && routePoints.end && (
        <Routing start={routePoints.start} end={routePoints.end} />
      )}
  {/* Listen for map clicks to set bubble location */}
  <MapEvents onClick={handleMapClick} />
      {bubbles.map((bubble, idx) => (
        <Marker key={bubble.id} position={[bubble.latitude, bubble.longitude]} icon={L.divIcon({ className: '', html: `<span style='font-size:28px;color:#22c55e;'>🫧</span>` })}>
          <Popup>
            <strong>{bubble.name}</strong><br />
            <span>{bubble.interest_tag}</span><br />
            <span>Members: {bubble.member_count}</span>
          </Popup>
        </Marker>
      ))}
      {/* Show nearby places as markers */}
      {nearbyPlaces.length > 0 && nearbyPlaces.map((place, idx) => (
        <Marker key={idx} position={[parseFloat(place.lat), parseFloat(place.lon)]}>
          <Popup>
            <strong>{place.display_name}</strong><br />
            <span>{place.type}</span>
          </Popup>
        </Marker>
      ))}
      {/* Show emoji reactions as markers */}
      {reactions.map((r, idx) => (
        <Marker key={idx} position={[r.lat, r.lng]} icon={L.divIcon({ className: '', html: `<span style='font-size:32px;'>${r.emoji}</span>` })}>
          <Popup>{r.emoji} Reaction</Popup>
        </Marker>
      ))}
      <TileLayer
        url={MAP_THEMES.find(t => t.key === mapTheme)?.url}
        attribution={MAP_THEMES.find(t => t.key === mapTheme)?.attribution}
      />
      {/* Clustered Markers */}
      <ClusteredMarkers locations={liveLocations} />
      {/* MiniMap */}
      <MiniMapControl />
      {/* Measurement Tool */}
      <MeasureControl />
      {/* Floating Action Button: Center map on first live user */}
      {liveLocations[0] && (
        <FloatingActionButton latlng={[liveLocations[0].latitude, liveLocations[0].longitude]} />
      )}
      {/* Custom control: live user count */}
      <UserCountControl count={liveLocations.length} />
      {/* Custom control: average distance between users */}
      <AvgDistanceControl locations={liveLocations} />
      {/* Custom control: heatmap hotspots */}
      <HeatmapStatsControl locations={liveLocations} />
      {/* Scale control for distance measurement */}
      <ScaleControl position="bottomleft" />
      {/* Map event handlers */}
      <MapEvents />
      {/* Routing/Directions demo: Hyderabad to nearby point */}
      <Routing start={[17.385, 78.4867]} end={[17.391, 78.490]} />
      {/* Geocoding/Search bar */}
      <Geosearch />
      {/* Drawing tools for polygons, polylines, rectangles, circles, markers */}
      <EditControl
        position="topright"
        draw={{
          rectangle: true,
          polyline: true,
          polygon: true,
          circle: true,
          marker: true,
        }}
  onCreated={handleGeofenceCreated}
      />
      {/* Optionally show a circle for story radius */}
      {showStories && liveLocations[0] && (
        <Circle
          center={[liveLocations[0].latitude, liveLocations[0].longitude] as [number, number]}
          radius={storyRadius}
          pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.2 }}
        />
      )}
    </MapContainer>
  </div>
  );



}
