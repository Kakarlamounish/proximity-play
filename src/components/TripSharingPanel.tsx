import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTripStore } from '@/stores/useTripStore';
import { useToast } from '@/hooks/use-toast';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Navigation, MapPin, Clock, Play, Square, Share2, Route,
  ChevronRight, Loader2, Check
} from 'lucide-react';

interface TripSharingPanelProps {
  userLocation?: { lat: number; lng: number } | null;
  initialDestination?: { name: string; lat: number; lng: number } | null;
}

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

function formatETA(isoString: string | null): string {
  if (!isoString) return '—';
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff < 0) return 'Arrived!';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

export function TripSharingPanel({ userLocation, initialDestination }: TripSharingPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const haptic = useHapticFeedback();
  const { trips, createTrip, cancelTrip, completeTrip, fetchTrips, activeTripId, getActiveTrip } = useTripStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedDest, setSelectedDest] = useState<SearchResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  const activeTrip = getActiveTrip();

  useEffect(() => {
    if (user) fetchTrips();
  }, [user]);

  // Pre-fill destination when navigating from a friend pin
  const prefilledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialDestination || !userLocation) return;
    const key = `${initialDestination.lat},${initialDestination.lng}`;
    if (prefilledRef.current === key) return;
    prefilledRef.current = key;
    const dest: SearchResult = {
      display_name: initialDestination.name,
      lat: String(initialDestination.lat),
      lon: String(initialDestination.lng),
    };
    setSelectedDest(dest);
    setSearchQuery(initialDestination.name);
    // Fetch route info
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${initialDestination.lng},${initialDestination.lat}?overview=false`
    )
      .then(r => r.json())
      .then(data => {
        if (data.routes?.[0]) {
          const dist = data.routes[0].distance;
          const dur = data.routes[0].duration;
          setRouteInfo({
            distance: dist > 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`,
            duration: dur > 3600
              ? `${Math.floor(dur / 3600)}h ${Math.round((dur % 3600) / 60)}m`
              : `${Math.round(dur / 60)} min`,
          });
        }
      })
      .catch(() => { /* skip */ });
  }, [initialDestination, userLocation]);


  const searchDestination = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`
      );
      const data = await res.json();
      setSearchResults(data);
    } catch {
      toast({ title: 'Search failed', variant: 'destructive' });
    } finally {
      setSearchLoading(false);
    }
  };

  const selectDestination = async (result: SearchResult) => {
    setSelectedDest(result);
    setSearchResults([]);
    setSearchQuery(result.display_name.split(',')[0]);

    if (userLocation) {
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${result.lon},${result.lat}?overview=false`
        );
        const data = await res.json();
        if (data.routes?.[0]) {
          const dist = data.routes[0].distance;
          const dur = data.routes[0].duration;
          setRouteInfo({
            distance: dist > 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`,
            duration: dur > 3600
              ? `${Math.floor(dur / 3600)}h ${Math.round((dur % 3600) / 60)}m`
              : `${Math.round(dur / 60)} min`,
          });
        }
      } catch { /* skip */ }
    }
  };

  const handleStartTrip = async () => {
    if (!user || !userLocation || !selectedDest) return;
    setCreating(true);
    haptic.success();
    try {
      const etaMs = routeInfo
        ? Date.now() + parseInt(routeInfo.duration) * 60000
        : Date.now() + 30 * 60000;

      await createTrip({
        name: `Trip to ${selectedDest.display_name.split(',')[0]}`,
        origin: { latitude: userLocation.lat, longitude: userLocation.lng },
        destination: { latitude: parseFloat(selectedDest.lat), longitude: parseFloat(selectedDest.lon) },
        route: [],
        eta: new Date(etaMs).toISOString(),
        sharedWith: [],
        createdBy: user.id,
      });
      setSelectedDest(null);
      setSearchQuery('');
      setRouteInfo(null);
      toast({ title: '🗺️ Trip started!', description: 'Your friends can now see your route' });
    } catch (err: any) {
      toast({ title: 'Failed to start trip', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleShare = () => {
    if (!activeTrip) return;
    haptic.light();
    const url = `${window.location.origin}/live?trip=${activeTrip.id}`;
    navigator.clipboard.writeText(url).then(() =>
      toast({ title: '🔗 Link copied!', description: 'Share this link with friends' })
    );
  };

  const handleComplete = async () => {
    if (!activeTripId) return;
    haptic.success();
    await completeTrip(activeTripId);
    toast({ title: '✅ Trip completed!' });
  };

  const handleCancel = async () => {
    if (!activeTripId) return;
    haptic.warning();
    await cancelTrip(activeTripId);
    toast({ title: 'Trip cancelled' });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <Route className="h-4 w-4 text-primary" />
          Live Trip Sharing
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Share your route with live ETA — friends see a moving marker
        </p>
      </div>

      {/* Active Trip View */}
      {activeTrip ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-semibold">{activeTrip.name}</span>
              </div>
              <Badge variant="secondary" className="text-xs capitalize">{activeTrip.status}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-background rounded-lg p-2.5">
                <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> ETA
                </div>
                <div className="font-bold text-sm">{formatETA(activeTrip.eta)}</div>
              </div>
              <div className="bg-background rounded-lg p-2.5">
                <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Destination
                </div>
                <div className="font-bold text-sm truncate">
                  {activeTrip.name.replace('Trip to ', '')}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={handleShare}>
                <Share2 className="h-3.5 w-3.5" />
                Share Link
              </Button>
              <Button size="sm" variant="outline" className="flex-1 gap-1 text-green-600 border-green-500/50" onClick={handleComplete}>
                <Check className="h-3.5 w-3.5" />
                Arrived
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={handleCancel}>
                <Square className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Start Trip Form */
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchDestination()}
                placeholder="Search destination..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button size="sm" onClick={searchDestination} disabled={searchLoading}>
                {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border rounded-lg overflow-hidden divide-y">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => selectDestination(r)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{r.display_name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected destination preview */}
            {selectedDest && (
              <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{selectedDest.display_name.split(',')[0]}</span>
                </div>
                {routeInfo && (
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>📍 {routeInfo.distance}</span>
                    <span>⏱️ ~{routeInfo.duration}</span>
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full gap-2"
              onClick={handleStartTrip}
              disabled={creating || !selectedDest || !userLocation}
            >
              {creating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Starting trip...</>
              ) : (
                <><Play className="h-4 w-4" /> Start Trip & Share</>
              )}
            </Button>

            {!userLocation && (
              <p className="text-xs text-muted-foreground text-center">
                📍 Enable location to start a trip
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent trips */}
      {trips.filter(t => t.status !== 'active').slice(0, 3).length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Recent Trips</p>
          <div className="space-y-2">
            {trips.filter(t => t.status !== 'active').slice(0, 3).map(trip => (
              <div key={trip.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate max-w-[160px]">{trip.name}</span>
                </div>
                <Badge variant={trip.status === 'completed' ? 'outline' : 'secondary'} className="text-xs capitalize">
                  {trip.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
