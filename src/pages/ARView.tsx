import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Camera, CameraOff, Compass, Navigation as NavIcon, Users,
  AlertCircle, MapPin, ChevronLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FriendMarker {
  id: string;
  name: string;
  distance: number; // meters
  bearing: number;  // degrees from north (0-360)
  avatar?: string;
}

// ── Compass bearing calculation ───────────────────────────────────────────────
function getBearing(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const φ1 = (fromLat * Math.PI) / 180;
  const φ2 = (toLat * Math.PI) / 180;
  const Δλ = ((toLng - fromLng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
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

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// ── Friend arrow overlay (positioned based on bearing relative to device heading) ──
function FriendArrow({ friend, deviceHeading }: { friend: FriendMarker; deviceHeading: number }) {
  // Relative angle: friend bearing minus device heading = screen angle
  const relativeAngle = (friend.bearing - deviceHeading + 360) % 360;
  const rad = (relativeAngle * Math.PI) / 180;

  // Map to screen position: center of screen + offset along angle
  const cx = 50; // % from left
  const cy = 50; // % from top
  const dist = 35; // % radius from center
  const x = cx + dist * Math.sin(rad);
  const y = cy - dist * Math.cos(rad);

  // Size based on distance (closer = bigger)
  const sizePct = Math.max(0.5, Math.min(1.4, 300 / (friend.distance + 10)));

  return (
    <div
      className="absolute flex flex-col items-center pointer-events-none transition-all duration-500"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) scale(${sizePct})`,
      }}
    >
      {/* Arrow */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white"
        style={{
          background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
          transform: `rotate(${relativeAngle}deg)`,
        }}
      >
        <NavIcon className="h-5 w-5 text-white" style={{ transform: 'rotate(0deg)' }} />
      </div>
      {/* Label */}
      <div
        className="mt-1 px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-lg"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      >
        {friend.name} · {formatDistance(friend.distance)}
      </div>
    </div>
  );
}

// ── Main AR page ─────────────────────────────────────────────────────────────
const ARView = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [deviceHeading, setDeviceHeading] = useState(0);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [friends, setFriends] = useState<FriendMarker[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Demo friends (in production these come from Supabase live_locations)
  const demoFriends = [
    { id: '1', name: 'Alice', lat: 0, lng: 0 },
    { id: '2', name: 'Bob', lat: 0, lng: 0 },
  ];

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setPermissionGranted(true);
    } catch (err: any) {
      setCameraError(err.message || 'Camera permission denied');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCameraActive(false);
  };

  // Device orientation for compass
  useEffect(() => {
    const handler = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null) setDeviceHeading(e.alpha);
    };
    window.addEventListener('deviceorientation', handler, true);
    return () => window.removeEventListener('deviceorientation', handler, true);
  }, []);

  // GPS watch
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(pos => {
      setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Compute friend overlays (demo: place them around user)
  useEffect(() => {
    if (!myLocation) return;
    const computed: FriendMarker[] = demoFriends.map((f, i) => {
      const offsetLat = myLocation.lat + (Math.random() - 0.5) * 0.01;
      const offsetLng = myLocation.lng + (Math.random() - 0.5) * 0.01;
      const dist = haversineDistance(myLocation.lat, myLocation.lng, offsetLat, offsetLng);
      const bearing = getBearing(myLocation.lat, myLocation.lng, offsetLat, offsetLng);
      return { ...f, lat: offsetLat, lng: offsetLng, distance: dist, bearing };
    });
    setFriends(computed);
  }, [myLocation]);

  useEffect(() => {
    return () => stopCamera(); // cleanup on unmount
  }, []);

  if (!user && !loading) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top bar */}
      <div className="relative z-20 flex items-center gap-3 p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
        <button onClick={() => navigate(-1)} className="text-white p-1">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-white font-bold text-lg">AR Friend Finder</h1>
        <Badge variant="secondary" className="ml-auto text-xs">
          <Compass className="h-3 w-3 mr-1" />
          {Math.round(deviceHeading)}°
        </Badge>
      </div>

      {/* Camera view */}
      <div className="relative flex-1 overflow-hidden">
        {cameraActive ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-900">
            {cameraError ? (
              <>
                <AlertCircle className="h-12 w-12 text-destructive" />
                <p className="text-white text-center px-8">{cameraError}</p>
                <p className="text-zinc-400 text-sm text-center px-8">
                  Enable camera access in your browser settings to use AR view
                </p>
              </>
            ) : (
              <>
                <Camera className="h-12 w-12 text-zinc-400" />
                <p className="text-white font-medium">Point camera at the world</p>
                <p className="text-zinc-400 text-sm text-center px-8">
                  See arrows showing where your friends are, overlaid on your camera view
                </p>
                <Button onClick={startCamera} className="gap-2 mt-2">
                  <Camera className="h-4 w-4" />
                  Enable Camera
                </Button>
              </>
            )}
          </div>
        )}

        {/* AR overlays */}
        {cameraActive && (
          <>
            {/* Crosshair */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 border-2 border-white/30 rounded-full" />
              <div className="absolute w-1 h-1 bg-white rounded-full" />
            </div>

            {/* Friend arrows */}
            {friends.map(friend => (
              <FriendArrow key={friend.id} friend={friend} deviceHeading={deviceHeading} />
            ))}

            {/* Compass ring */}
            <div
              className="absolute bottom-32 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full border-2 border-white/40 flex items-center justify-center"
              style={{ transform: `translateX(-50%) rotate(${-deviceHeading}deg)` }}
            >
              <span className="text-white text-xs font-bold" style={{ transform: `rotate(${deviceHeading}deg)` }}>N</span>
            </div>
          </>
        )}
      </div>

      {/* Bottom controls */}
      <div className="relative z-20 p-4 pb-6 flex items-center gap-3" style={{ background: 'rgba(0,0,0,0.7)' }}>
        {myLocation ? (
          <div className="flex items-center gap-1 text-xs text-green-400">
            <MapPin className="h-3.5 w-3.5" />
            <span>{myLocation.lat.toFixed(4)}, {myLocation.lng.toFixed(4)}</span>
          </div>
        ) : (
          <div className="text-xs text-zinc-400">Waiting for GPS...</div>
        )}

        <div className="ml-auto flex gap-2">
          {cameraActive ? (
            <Button size="sm" variant="destructive" onClick={stopCamera} className="gap-1">
              <CameraOff className="h-4 w-4" />
              Stop
            </Button>
          ) : permissionGranted ? (
            <Button size="sm" onClick={startCamera} className="gap-1">
              <Camera className="h-4 w-4" />
              Resume
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ARView;
