import React, { useMemo } from 'react';

export type CallQualityLevel = 'good' | 'fair' | 'poor';

export function deriveQualityLevel(stats: {
  rttMs?: number;
  jitterMs?: number;
  packetsLost?: number;
}): CallQualityLevel {
  const { rttMs, jitterMs, packetsLost } = stats;
  if (
    (rttMs != null && rttMs > 400) ||
    (jitterMs != null && jitterMs > 80) ||
    (packetsLost != null && packetsLost > 50)
  ) return 'poor';
  if (
    (rttMs != null && rttMs > 150) ||
    (jitterMs != null && jitterMs > 30) ||
    (packetsLost != null && packetsLost > 10)
  ) return 'fair';
  return 'good';
}

const colors: Record<CallQualityLevel, string> = {
  good: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
  fair: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  poor: 'bg-destructive/20 text-destructive border-destructive/30',
};

const labels: Record<CallQualityLevel, string> = {
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

interface CallQualityBadgeProps {
  level: CallQualityLevel;
}

export const CallQualityBadge: React.FC<CallQualityBadgeProps> = ({ level }) => (
  <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${colors[level]}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${level === 'good' ? 'bg-green-500' : level === 'fair' ? 'bg-yellow-500' : 'bg-destructive'}`} />
    {labels[level]}
  </span>
);
