import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Package, MapPin, Plus, Trash2, Eye, Clock, MessageSquare,
  Image as ImageIcon, Mic, Lock, Unlock, Navigation
} from 'lucide-react';

interface DeadDrop {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'image' | 'voice';
  latitude: number;
  longitude: number;
  radius: number;
  created_by: string;
  created_at: string;
  expires_at?: string;
  viewed_by: string[];
  max_views?: number;
}

interface DeadDropPanelProps {
  userLocation?: { lat: number; lng: number } | null;
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

export function DeadDropPanel({ userLocation }: DeadDropPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const haptic = useHapticFeedback();

  const [drops, setDrops] = useState<DeadDrop[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [radius, setRadius] = useState(50);
  const [revealedDrops, setRevealedDrops] = useState<Set<string>>(new Set());

  const fetchNearby = useCallback(async () => {
    if (!userLocation) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_nearby_dead_drops', {
        user_lat: userLocation.lat,
        user_lng: userLocation.lng,
      });
      if (!error && data) {
        setDrops(data as DeadDrop[]);
      }
    } catch {
      // Fallback: fetch all drops and filter client-side
      const { data } = await supabase
        .from('dead_drops')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) {
        const nearby = (data as DeadDrop[]).filter((d) => {
          const dist = haversineDistance(userLocation.lat, userLocation.lng, d.latitude, d.longitude);
          return dist <= d.radius + 200; // show drops within radius + 200m buffer
        });
        setDrops(nearby);
      }
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  useEffect(() => {
    fetchNearby();
    const interval = setInterval(fetchNearby, 30_000);
    return () => clearInterval(interval);
  }, [fetchNearby]);

  const getDistanceToDropMeters = (drop: DeadDrop): number | null => {
    if (!userLocation) return null;
    return haversineDistance(userLocation.lat, userLocation.lng, drop.latitude, drop.longitude);
  };

  const isUnlocked = (drop: DeadDrop): boolean => {
    const dist = getDistanceToDropMeters(drop);
    return dist !== null && dist <= drop.radius;
  };

  const handleReveal = async (drop: DeadDrop) => {
    if (!user || !isUnlocked(drop)) return;
    haptic.success();
    setRevealedDrops((prev) => new Set(prev).add(drop.id));
    // Mark as viewed
    const viewed_by = [...(drop.viewed_by || []), user.id];
    await supabase.from('dead_drops').update({ viewed_by }).eq('id', drop.id);
  };

  const handleCreate = async () => {
    if (!user || !userLocation || !content.trim()) return;
    setCreating(true);
    haptic.medium();
    try {
      const { error } = await supabase.from('dead_drops').insert({
        title: title || 'Secret Message',
        content,
        type: 'text',
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        radius,
        created_by: user.id,
        viewed_by: [],
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), // 7 days
      });
      if (error) throw error;
      toast({ title: '📦 Dead Drop created!', description: `Hidden at your current location (${radius}m radius)` });
      setShowForm(false);
      setTitle('');
      setContent('');
      fetchNearby();
    } catch (err: any) {
      toast({ title: 'Failed to create', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('dead_drops').delete().eq('id', id);
    setDrops((prev) => prev.filter((d) => d.id !== id));
    toast({ title: 'Dead Drop removed' });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Dead Drops
            {drops.length > 0 && (
              <Badge variant="secondary" className="text-xs">{drops.length} nearby</Badge>
            )}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Leave hidden messages at coordinates — only visible when friends physically arrive
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          disabled={!userLocation}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Drop
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="border border-primary/30 bg-primary/5 animate-in slide-in-from-top-2">
          <CardContent className="pt-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Secret message..."
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Message *</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Leave a message only visible at this spot..."
                rows={3}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Unlock radius: <span className="text-primary font-bold">{radius}m</span>
              </label>
              <input
                type="range" min={10} max={500} step={10} value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full mt-1 accent-primary"
              />
            </div>
            {userLocation && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>Will be placed at: {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}</span>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={creating || !content.trim()} className="flex-1">
                {creating ? 'Dropping...' : '📦 Create Drop'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drops List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-40 animate-pulse" />
          Scanning nearby drops...
        </div>
      ) : drops.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>No dead drops nearby.</p>
          <p className="text-xs mt-1">Create one to leave a surprise for friends!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {drops.map((drop) => {
            const dist = getDistanceToDropMeters(drop);
            const unlocked = isUnlocked(drop);
            const revealed = revealedDrops.has(drop.id);
            const isMine = drop.created_by === user?.id;

            return (
              <Card
                key={drop.id}
                className={`transition-all duration-300 ${
                  unlocked
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-dashed opacity-80'
                }`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-1.5 rounded-full shrink-0 ${unlocked ? 'bg-green-500/20 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                        {unlocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{drop.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Navigation className="h-3 w-3" />
                            {dist !== null ? (
                              dist < 1000 ? `${Math.round(dist)}m away` : `${(dist / 1000).toFixed(1)}km away`
                            ) : 'Unknown distance'}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {drop.viewed_by?.length || 0} views
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isMine && (
                        <button
                          onClick={() => handleDelete(drop.id)}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Content reveal */}
                  {unlocked && !revealed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2 border-green-500/50 text-green-600 hover:bg-green-500/10"
                      onClick={() => handleReveal(drop)}
                    >
                      <Unlock className="h-3.5 w-3.5 mr-1" />
                      Reveal Message
                    </Button>
                  )}

                  {revealed && (
                    <div className="mt-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20 animate-in fade-in">
                      <p className="text-sm">{drop.content}</p>
                    </div>
                  )}

                  {!unlocked && dist !== null && (
                    <div className="mt-2">
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.max(0, Math.min(100, 100 - (dist / (drop.radius + 200)) * 100))}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Walk {Math.round(Math.max(0, dist - drop.radius))}m closer to unlock
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
