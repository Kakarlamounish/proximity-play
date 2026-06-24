// Lightweight haptic helpers built on navigator.vibrate.
// Safe no-op on unsupported devices (iOS Safari, desktop).

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  selection: 5,
  success: [15, 50, 15],
  warning: [30, 80, 30],
  error: [50, 100, 50, 100, 50],
};

function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function haptic(pattern: HapticPattern = 'light') {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    /* no-op */
  }
}

export function hapticCustom(pattern: number | number[]) {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* no-op */
  }
}
