import React from 'react';
import { useBatterySaver } from '@/hooks/useBatterySaver';
import { Battery, BatteryLow, EyeOff } from 'lucide-react';

/**
 * Fixed top banner shown when battery saver mode is active.
 * Communicates to users that GPS polling has been reduced.
 */
export function BatterySaverBanner() {
  const { saverActive, backgrounded, level, charging } = useBatterySaver();

  if (!saverActive) return null;

  const lowBattery = level !== null && level < 0.2 && !charging;
  const pct = level !== null ? Math.round(level * 100) : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-16 left-0 right-0 z-50 flex items-center justify-center gap-2 py-1.5 px-4 text-xs font-medium"
      style={{
        background: 'linear-gradient(90deg, rgba(234,179,8,0.92), rgba(202,138,4,0.92))',
        color: '#1a1100',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 2px 8px rgba(234,179,8,0.3)',
        animation: 'slideDown 0.3s ease-out',
      }}
    >
      {backgrounded ? (
        <>
          <EyeOff className="h-3.5 w-3.5 shrink-0" />
          <span>App in background — GPS reduced to every 2 min</span>
        </>
      ) : (
        <>
          <BatteryLow className="h-3.5 w-3.5 shrink-0" />
          <span>
            Battery Saver Active {pct !== null ? `(${pct}%)` : ''} — GPS reduced to every 60s
          </span>
        </>
      )}
    </div>
  );
}
