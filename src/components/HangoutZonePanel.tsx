import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useHapticFeedback, hapticPatterns } from '@/hooks/useHapticFeedback';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Party, Users, MapPin, Plus, Trash2, Zap, Circle as CircleIcon } from 'lucide-react';

interface HangoutZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  created_by: string;
  created_at: string;
  expires_at: string;
  bubble_id?: string;
  inside_user_ids: string[];
}

interface HangoutZonePanelProps {
  userLocation?: { lat: number; lng: number } | null;
  bubbleId?: string;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatExpiry(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff < 0) return 'Expired';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.round((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

const ZONE_EMOJIS = ['🎉', '🎵', '🍕', '🏋️', '📚', '☕', '🎮', '🌲', '🏖️', '🎤'];

export function HangoutZonePanel({ userLocation, bubbleId }: HangoutZonePanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const haptic = useHapticFeedback();

  const [zones, setZones] = useState<HangoutZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🎉');
  const [radius, setRadius] = useState(100);
  const [duration, setDuration] = useState(2); // hours
  const [creating, setCreating] = useState(false);
  const prevInsideRef = useRef<Set<string>>(new Set());

  const fetchZones = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('hangout_zones')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (bubbleId) query = query.eq('bubble_id', bubbleId);
      const { data } = await query;
      setZones((data as HangoutZone[]) || []);
    } catch {
      // Table may not exist yet; silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
    const interval = setInterval(fetchZones, 15_000);
    return () => clearInterval(interval);
  }, [bubbleId]);

  // Check if user entered/exited any zone and fire haptic
  useEffect(() => {
    if (!userLocation || !user) return;
    const nowInside = new Set<string>();
    zones.forEach(zone => {
      const dist = haversineDistance(userLocation.lat, userLocation.lng, zone.latitude, zone.longitude);
      if (dist <= zone.radius) nowInside.add(zone.id);
    });
    // Detect new entries
    nowInside.forEach(id => {
      if (!prevInsideRef.current.has(id)) {
        navigator.vibrate?.(hapticPatterns.geofenceEnter);
        const zone = zones.find(z => z.id === id);
        if (zone) toast({ title: `${zone.name}`, description: '🎉 You entered a hangout zone!' });
      }
    });
    prevInsideRef.current = nowInside;
  }, [userLocation, zones]);

  const isInsideZone = (zone: HangoutZone): boolean => {
    if (!userLocation) return false;
    return haversineDistance(userLocation.lat, userLocation.lng, zone.latitude, zone.longitude) <= zone.radius;
  };

  const handleCreate = async () => {
    if (!user || !userLocation) return;
    setCreating(true);
    haptic.success();
    try {
      const { error } = await supabase.from('hangout_zones').insert({
        name: `${selectedEmoji} ${zoneName || 'Hangout Zone'}`,
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        radius,
        created_by: user.id,
        bubble_id: bubbleId || null,
        expires_at: new Date(Date.now() + duration * 3600000).toISOString(),
        inside_user_ids: [user.id],
      });
      if (error) throw error;
      toast({ title: '🎉 Hangout zone created!', description: `Active for ${duration}h` });
      setShowForm(false);
      setZoneName('');
      fetchZones();
    } catch (err: any) {
      // If table doesn't exist, show helpful message
      if (err.code === '42P01') {
        toast({
          title: 'Migration needed',
          description: 'Run the DB migration to enable hangout zones',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Failed', description: err.message, variant: 'destructive' });
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('hangout_zones').delete().eq('id', id);
    setZones(prev => prev.filter(z => z.id !== id));
    toast({ title: 'Zone removed' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Hangout Zones
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create a temporary meetup zone — everyone inside gets a badge
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)} disabled={!userLocation} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          Zone
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="border border-primary/30 bg-primary/5 animate-in slide-in-from-top-2">
          <CardContent className="pt-4 space-y-3">
            {/* Emoji picker */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Pick an emoji</label>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {ZONE_EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => setSelectedEmoji(e)}
                    className={`text-xl p-1 rounded-lg transition-all ${
                      selectedEmoji === e ? 'bg-primary/20 scale-125' : 'hover:bg-muted'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Zone name</label>
              <input
                type="text"
                value={zoneName}
                onChange={e => setZoneName(e.target.value)}
                placeholder="Concert meetup, Coffee run..."
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Radius: <span className="text-primary">{radius}m</span>
                </label>
                <input type="range" min={25} max={500} step={25} value={radius}
                  onChange={e => setRadius(Number(e.target.value))}
                  className="w-full mt-1 accent-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Duration: <span className="text-primary">{duration}h</span>
                </label>
                <input type="range" min={1} max={24} step={1} value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  className="w-full mt-1 accent-primary"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={creating} className="flex-1">
                {creating ? 'Creating...' : `${selectedEmoji} Create Zone`}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Zones list */}
      {zones.length === 0 && !showForm ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Zap className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>No active hangout zones.</p>
          <p className="text-xs mt-1">Create one to gather your group!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {zones.map(zone => {
            const inside = isInsideZone(zone);
            return (
              <Card key={zone.id} className={`transition-all ${inside ? 'border-primary/50 bg-primary/5' : ''}`}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-full text-lg ${inside ? 'bg-primary/20 animate-pulse' : 'bg-muted'}`}>
                        {zone.name.split(' ')[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{zone.name.split(' ').slice(1).join(' ') || zone.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{zone.radius}m radius</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{formatExpiry(zone.expires_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {inside && (
                        <Badge className="text-xs bg-primary text-primary-foreground">
                          ✨ Inside!
                        </Badge>
                      )}
                      {zone.created_by === user?.id && (
                        <button
                          onClick={() => handleDelete(zone.id)}
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
