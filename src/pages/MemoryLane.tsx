import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { useHeatmapStore, HeatmapTimeRange } from '@/stores/useHeatmapStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Flame, Calendar, Share2, Download, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet.heat';

// ── Heatmap layer component ──────────────────────────────────────────────────
function HeatLayer({ points }: { points: [number, number, number?][] }) {
  const map = useMap();
  const heatRef = useRef<any>(null);

  useEffect(() => {
    if (heatRef.current) {
      map.removeLayer(heatRef.current);
    }
    if (points.length > 0) {
      heatRef.current = (L as any).heatLayer(points, {
        radius: 30,
        blur: 20,
        maxZoom: 17,
        gradient: { 0.2: '#3b82f6', 0.5: '#8b5cf6', 0.7: '#f59e0b', 1.0: '#ef4444' },
      });
      heatRef.current.addTo(map);
    }
    return () => {
      if (heatRef.current) map.removeLayer(heatRef.current);
    };
  }, [points, map]);

  return null;
}

// ── Stats bar ────────────────────────────────────────────────────────────────
function Stats({ points }: { points: { latitude: number; longitude: number; intensity: number; timestamp: Date }[] }) {
  if (points.length === 0) return null;

  const hottest = points.reduce((a, b) => (a.intensity > b.intensity ? a : b), points[0]);
  const totalTime = points.length * 30; // ~30 sec per sample
  const hours = Math.floor(totalTime / 3600);
  const mins = Math.floor((totalTime % 3600) / 60);

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {[
        { label: 'Check-ins', value: points.length.toLocaleString(), icon: '📍' },
        { label: 'Time tracked', value: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`, icon: '⏱️' },
        { label: 'Hottest spot', value: `${hottest.latitude.toFixed(3)}, ${hottest.longitude.toFixed(3)}`, icon: '🔥' },
      ].map(stat => (
        <Card key={stat.label} className="glass border-0">
          <CardContent className="p-3 text-center">
            <div className="text-lg mb-0.5">{stat.icon}</div>
            <div className="text-sm font-bold">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
const TIME_RANGES: { label: string; value: HeatmapTimeRange }[] = [
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'This Year', value: 'year' },
  { label: 'All Time', value: 'all' },
];

const MemoryLane = () => {
  const { user, loading } = useAuth();
  const { points: allPoints, loading: dataLoading, fetchHeatmap } = useHeatmapStore();
  const [timeRange, setTimeRange] = useState<HeatmapTimeRange>('month');
  const [mapCenter, setMapCenter] = useState<[number, number]>([20, 0]);
  const [mapZoom, setMapZoom] = useState(2);

  const userPoints = user ? allPoints[user.id] || [] : [];

  const heatmapPoints: [number, number, number?][] = userPoints.map(p => [
    p.latitude, p.longitude, Math.min(p.intensity, 1),
  ]);

  useEffect(() => {
    if (user) {
      fetchHeatmap(user.id, timeRange).then(pts => {
        if (pts.length > 0) {
          // Center map on the hottest cluster
          const hottest = pts.reduce((a, b) => a.intensity > b.intensity ? a : b, pts[0]);
          setMapCenter([hottest.latitude, hottest.longitude]);
          setMapZoom(11);
        }
      });
    }
  }, [user, timeRange]);

  const handleExport = () => {
    if (userPoints.length === 0) return;
    const csv = [
      'latitude,longitude,intensity,timestamp',
      ...userPoints.map(p => `${p.latitude},${p.longitude},${p.intensity},${p.timestamp.toISOString()}`),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memory-lane-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!user && !loading) return <Navigate to="/auth" replace />;
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Flame className="h-8 w-8 text-orange-500" />
              Memory Lane
            </h1>
            <p className="text-muted-foreground mt-1">
              Visualize where you've spent your time — your personal heatmap
            </p>
          </div>

          {/* Time range selector */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {TIME_RANGES.map(({ label, value }) => (
              <Button
                key={value}
                size="sm"
                variant={timeRange === value ? 'default' : 'outline'}
                onClick={() => setTimeRange(value)}
                className="gap-1"
              >
                <Calendar className="h-3.5 w-3.5" />
                {label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={handleExport} className="ml-auto gap-1">
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>

          {/* Stats */}
          <Stats points={userPoints} />

          {/* Map */}
          <Card className="overflow-hidden border-0 shadow-xl">
            <div style={{ height: 480 }} className="relative">
              {dataLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              {userPoints.length === 0 && !dataLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-muted-foreground">
                  <MapPin className="h-12 w-12 mb-3 opacity-40" />
                  <p className="font-medium">No location data yet</p>
                  <p className="text-sm mt-1">Use the live map to start building your memory lane</p>
                </div>
              )}
              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap contributors"
                />
                {heatmapPoints.length > 0 && <HeatLayer points={heatmapPoints} />}
              </MapContainer>
            </div>
          </Card>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground justify-center">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Rarely visited</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span>Sometimes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Often</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Hotspot</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemoryLane;
