import React, { useState, useEffect } from 'react';
import { useLocation } from '@/hooks/useLocation';
import { MapPin, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * A beautiful, premium informational banner shown when running as an installed PWA.
 * Explains OS-level background location tracking limitations so users are not confused by stale locations.
 */
export function PWALocationBanner() {
  const { isPWA } = useLocation();
  const [dismissed, setDismissed] = useState(true); // Default to true until we check localStorage

  useEffect(() => {
    if (isPWA) {
      const isDismissed = localStorage.getItem('pwa-location-banner-dismissed') === 'true';
      setDismissed(isDismissed);
    }
  }, [isPWA]);

  if (!isPWA || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem('pwa-location-banner-dismissed', 'true');
    setDismissed(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-[72px] left-1/2 -translate-x-1/2 z-[999] w-[calc(100%-2rem)] max-w-md pointer-events-auto"
      style={{
        animation: 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div className="glass-card bg-background/85 dark:bg-background/80 backdrop-blur-lg border border-primary/20 dark:border-primary/10 rounded-2xl shadow-xl p-3.5 flex items-start gap-3 relative overflow-hidden">
        {/* Ambient glow accent */}
        <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />

        <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0">
          <MapPin className="h-4 w-4" />
        </div>

        <div className="space-y-1 pr-6 flex-1">
          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            PWA Background Location Notice
          </h4>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Mobile operating systems restrict background GPS for PWAs. To share your live location continuously, please keep the app open in the foreground.
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
          onClick={handleDismiss}
          aria-label="Dismiss banner"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
