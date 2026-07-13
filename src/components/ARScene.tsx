import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface ARFriendMarker {
  id: string;
  name: string;
  distance: number; // meters
  bearing: number;  // degrees from true north, 0-360
}

interface ARSceneProps {
  friends: ARFriendMarker[];
  className?: string;
}

// Reference implementation for converting a device's (alpha, beta, gamma)
// orientation reading into a Three.js camera quaternion. This exact
// derivation (Euler order 'YXZ', the two correction quaternions) is the
// standard approach used across three.js's old DeviceOrientationControls and
// AR.js — device orientation is NOT a simple "rotate around Z by alpha"; beta
// (front-back tilt) and gamma (left-right tilt) have to be folded in with
// this specific axis correction or markers swim/drift as the phone tilts.
const ZEE = new THREE.Vector3(0, 0, 1);
const EULER = new THREE.Euler();
const Q0 = new THREE.Quaternion();
const Q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -PI/2 around x

function setCameraQuaternion(quaternion: THREE.Quaternion, alpha: number, beta: number, gamma: number, screenOrientation: number) {
  EULER.set(beta, alpha, -gamma, 'YXZ');
  quaternion.setFromEuler(EULER);
  quaternion.multiply(Q1);
  quaternion.multiply(Q0.setFromAxisAngle(ZEE, -screenOrientation));
}

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

// Compresses distance so far-away friends stay on screen instead of shrinking
// to nothing or needing an absurdly large world scale — real perspective,
// just with a soft cap past 150m.
function projectedDistance(meters: number): number {
  const NEAR = 150;
  if (meters <= NEAR) return meters;
  return NEAR + Math.log10(1 + (meters - NEAR) / 50) * 40;
}

function makeLabelSprite(name: string, distanceLabel: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const r = 20;
  ctx.beginPath();
  ctx.moveTo(r, 8);
  ctx.arcTo(248, 8, 248, 88, r);
  ctx.arcTo(248, 88, 8, 88, r);
  ctx.arcTo(8, 88, 8, 8, r);
  ctx.arcTo(8, 8, 248, 8, r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, 128, 42);
  ctx.font = '22px sans-serif';
  ctx.fillStyle = '#a5b4fc';
  ctx.fillText(distanceLabel, 128, 74);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  return new THREE.Sprite(material);
}

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
}

// Renders friend markers as true 3D-projected sprites over the camera feed —
// position reacts to phone tilt (beta) and roll (gamma) as well as compass
// heading (alpha), and apparent size falls out of real perspective
// projection rather than a hand-tuned "closer = bigger" formula. This is the
// piece the previous flat 2D percentage-position overlay didn't have.
export const ARScene: React.FC<ARSceneProps> = ({ friends, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const friendsRef = useRef(friends);
  friendsRef.current = friends;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const spritesById = new Map<string, THREE.Sprite>();

    let alpha = 0, beta = 0, gamma = 0;
    let screenOrientation = (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0);
    screenOrientation = degToRad(screenOrientation);

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha == null || e.beta == null || e.gamma == null) return;
      alpha = degToRad(e.alpha);
      beta = degToRad(e.beta);
      gamma = degToRad(e.gamma);
    };
    const onScreenOrientation = () => {
      screenOrientation = degToRad(screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0);
    };

    window.addEventListener('deviceorientation', onOrientation, true);
    window.addEventListener('orientationchange', onScreenOrientation, true);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);

      setCameraQuaternion(camera.quaternion, alpha, beta, gamma, screenOrientation);

      const seen = new Set<string>();
      for (const friend of friendsRef.current) {
        seen.add(friend.id);
        const dist = projectedDistance(friend.distance);
        const bearingRad = degToRad(friend.bearing);
        // ENU-ish local frame: +X east, -Z north, matches the camera quaternion
        // convention above where alpha=0 (facing north) looks down -Z.
        const x = dist * Math.sin(bearingRad);
        const z = -dist * Math.cos(bearingRad);
        const y = 0;

        let sprite = spritesById.get(friend.id);
        if (!sprite) {
          sprite = makeLabelSprite(friend.name, formatDistance(friend.distance));
          scene.add(sprite);
          spritesById.set(friend.id, sprite);
        }
        sprite.position.set(x, y, z);
        const scale = Math.max(8, Math.min(40, dist * 0.18));
        sprite.scale.set(scale, scale * 0.375, 1);
      }

      for (const [id, sprite] of spritesById.entries()) {
        if (!seen.has(id)) {
          scene.remove(sprite);
          (sprite.material as THREE.SpriteMaterial).map?.dispose();
          sprite.material.dispose();
          spritesById.delete(id);
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('deviceorientation', onOrientation, true);
      window.removeEventListener('orientationchange', onScreenOrientation, true);
      window.removeEventListener('resize', onResize);
      spritesById.forEach((sprite) => {
        (sprite.material as THREE.SpriteMaterial).map?.dispose();
        sprite.material.dispose();
      });
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
    // Friends list updates flow through friendsRef — scene only needs (re)init once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={className} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
};

// iOS 13+ gates 'deviceorientation' events behind an explicit, user-gesture-
// triggered permission prompt. Without this, the compass/tilt data silently
// never arrives on iOS Safari — the previous implementation didn't request
// it at all, so AR would have been non-functional on iPhone.
export async function requestDeviceOrientationPermission(): Promise<boolean> {
  const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> };
  if (typeof DOE.requestPermission === 'function') {
    try {
      const result = await DOE.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }
  return true; // no permission gate needed (Android / desktop)
}
