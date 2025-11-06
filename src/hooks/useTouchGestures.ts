import { useGesture } from '@use-gesture/react';
import { useCallback } from 'react';

interface TouchGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPinch?: (scale: number) => void;
  onDoubleTap?: () => void;
  threshold?: number;
}

export const useTouchGestures = ({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onPinch,
  onDoubleTap,
  threshold = 50,
}: TouchGestureOptions) => {
  const bind = useGesture(
    {
      onDrag: ({ movement: [mx, my], last, tap }) => {
        if (!last) return;

        // Detect swipe direction
        if (Math.abs(mx) > Math.abs(my)) {
          // Horizontal swipe
          if (mx > threshold && onSwipeRight) {
            onSwipeRight();
          } else if (mx < -threshold && onSwipeLeft) {
            onSwipeLeft();
          }
        } else {
          // Vertical swipe
          if (my > threshold && onSwipeDown) {
            onSwipeDown();
          } else if (my < -threshold && onSwipeUp) {
            onSwipeUp();
          }
        }
      },
      onPinch: ({ offset: [scale] }) => {
        if (onPinch) {
          onPinch(scale);
        }
      },
      onDoubleClick: () => {
        if (onDoubleTap) {
          onDoubleTap();
        }
      },
    },
    {
      drag: {
        filterTaps: true,
        threshold: 10,
      },
      pinch: {
        scaleBounds: { min: 0.5, max: 3 },
      },
    }
  );

  return bind;
};

// Hook for pull-to-refresh
export const usePullToRefresh = (onRefresh: () => Promise<void>) => {
  const bind = useGesture({
    onDrag: ({ movement: [, my], last, velocity: [, vy] }) => {
      // Only trigger on downward pull from top of page
      if (window.scrollY === 0 && my > 80 && last && vy > 0.3) {
        onRefresh();
      }
    },
  });

  return bind;
};

// Hook for long press
export const useLongPress = (
  callback: () => void,
  duration: number = 500
) => {
  let timerId: NodeJS.Timeout | null = null;

  const start = useCallback(() => {
    timerId = setTimeout(() => {
      callback();
    }, duration);
  }, [callback, duration]);

  const cancel = useCallback(() => {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  }, []);

  return {
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: cancel,
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
  };
};
