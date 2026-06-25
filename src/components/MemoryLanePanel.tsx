import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useHeatmapStore, HeatmapTimeRange } from '@/stores/useHeatmapStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Download } from 'lucide-react';

const TIME_RANGES: { label: string; value: HeatmapTimeRange }[] = [
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'This Year', value: 'year' },
  { label: 'All Time', value: 'all' },
];

function Stats({ points }: { points: { latitude: number; longitude: number; intensity: number; timestamp: Date }[] }) {
  if (points.length === 0) return null;

  const hottest = points.reduce((a, b) => (a.intensity > b.intensity ? a : b), points[0]);
  const totalTime = points.length * 30; // ~30 sec per sample
  const hours = Math.floor(totalTime / 3600);
  const mins = Math.floor((totalTime % 3600) / 60);

  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      {[
        { label: 'Check-ins', value: points.length.toLocaleString(), icon: '📍' },
        { label: 'Time tracked', value: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`, icon: '⏱️' },
        { label: 'Hottest spot', value: `${hottest.latitude.toFixed(2)}, ${hottest.longitude.toFixed(2)}`, icon: '🔥' },
      ].map(stat => (
        <Card key={stat.label} className="bg-card/50 border-0 shadow-sm">
          <CardContent className="p-2 text-center">
            <div className="text-lg mb-0.5">{stat.icon}</div>
            <div className="text-sm font-bold truncate">{stat.value}</div>
            <div className="text-[10px] text-muted-foreground uppercase">{stat.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function MemoryLanePanel() {
  const { user } = useAuth();
  const { points: allPoints, fetchHeatmap } = useHeatmapStore();
  const [timeRange, setTimeRange] = useState<HeatmapTimeRange>('month');

  const userPoints = user ? allPoints[user.id] || [] : [];

  useEffect(() => {
    if (user) {
      fetchHeatmap(user.id, timeRange);
    }
  }, [user, timeRange, fetchHeatmap]);

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

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2 flex-wrap">
        {TIME_RANGES.map(({ label, value }) => (
          <Button
            key={value}
            size="sm"
            variant={timeRange === value ? 'default' : 'outline'}
            onClick={() => setTimeRange(value)}
            className="gap-1 flex-1 min-w-[100px]"
          >
            <Calendar className="h-3.5 w-3.5" />
            {label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={handleExport} className="w-full gap-1 mt-2">
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      <Stats points={userPoints} />

      <div className="flex items-center gap-4 text-xs text-muted-foreground justify-center p-2 bg-muted/20 rounded-xl">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Rare</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span>Some</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span>Often</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Hot</span>
        </div>
      </div>
      
      {userPoints.length === 0 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          No location data found for this time range.
        </div>
      )}
    </div>
  );
}
