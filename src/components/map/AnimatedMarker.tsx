import React, { useEffect, useRef, useState } from 'react';
import { Marker, MarkerProps } from 'react-leaflet';
import L from 'leaflet';

export function AnimatedMarker(props: MarkerProps) {
  const markerRef = useRef<L.Marker>(null);
  
  // We keep a stable position for the React-Leaflet wrapper so it doesn't auto-teleport.
  // We manually animate the actual Leaflet marker instance via ref.
  const [internalPos, setInternalPos] = useState(props.position);
  const prevPos = useRef(props.position);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!markerRef.current) return;
    const marker = markerRef.current;
    
    const newPos = L.latLng(props.position as any);
    const oldPos = L.latLng(prevPos.current as any);
    
    // If position hasn't changed, do nothing
    if (newPos.equals(oldPos)) return;

    // Cancel any ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const duration = 1200; // ms
    const start = performance.now();
    
    const animate = (time: number) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeOutQuart for a smooth, natural glide
      const ease = 1 - Math.pow(1 - progress, 4);
      
      const lat = oldPos.lat + (newPos.lat - oldPos.lat) * ease;
      const lng = oldPos.lng + (newPos.lng - oldPos.lng) * ease;
      
      marker.setLatLng([lat, lng]);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        prevPos.current = props.position;
        setInternalPos(props.position); // Sync back to React state when done
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [props.position]);

  return <Marker ref={markerRef} {...props} position={internalPos} />;
}
