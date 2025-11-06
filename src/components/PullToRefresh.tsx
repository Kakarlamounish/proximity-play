import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false,
}) => {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const threshold = 80;
  const maxPull = 150;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0 && !isRefreshing) {
        startY.current = e.touches[0].clientY;
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const distance = Math.min(currentY - startY.current, maxPull);

      if (distance > 0 && window.scrollY === 0) {
        setPullDistance(distance);
        // Prevent default scroll behavior when pulling
        if (distance > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling || isRefreshing) return;

      setIsPulling(false);

      if (pullDistance >= threshold) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPulling, isRefreshing, pullDistance, onRefresh, disabled]);

  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 360;
  const opacity = Math.min(progress, 1);

  return (
    <div ref={containerRef} className="relative h-full">
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none transition-all duration-200"
        style={{
          height: pullDistance,
          opacity: opacity,
        }}
      >
        <div
          className="flex flex-col items-center gap-2"
          style={{
            transform: `translateY(${Math.max(0, pullDistance - 60)}px)`,
          }}
        >
          <RefreshCw
            className={`h-6 w-6 text-primary ${isRefreshing ? 'animate-spin' : ''}`}
            style={{
              transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
            }}
          />
          <span className="text-sm text-muted-foreground font-medium">
            {isRefreshing
              ? 'Refreshing...'
              : pullDistance >= threshold
              ? 'Release to refresh'
              : 'Pull to refresh'}
          </span>
        </div>
      </div>

      {/* Content with offset during pull */}
      <div
        className="transition-transform duration-200"
        style={{
          transform: isPulling || isRefreshing ? `translateY(${pullDistance}px)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};
