import React from 'react';
import { Flame, Timer } from 'lucide-react';

interface SnapStreakBadgeProps {
  count: number;
  isExpiring?: boolean;
  size?: 'sm' | 'md';
}

export function SnapStreakBadge({ count, isExpiring, size = 'sm' }: SnapStreakBadgeProps) {
  if (count <= 0) return null;

  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5 gap-0.5' : 'text-sm px-2 py-1 gap-1';

  return (
    <span className={`inline-flex items-center rounded-full font-bold ${sizeClasses} ${
      isExpiring
        ? 'bg-destructive/20 text-destructive animate-pulse'
        : count >= 100
          ? 'bg-primary/20 text-primary'
          : 'bg-orange-500/20 text-orange-500'
    }`}>
      <Flame className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {count}
      {isExpiring && <Timer className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />}
    </span>
  );
}
