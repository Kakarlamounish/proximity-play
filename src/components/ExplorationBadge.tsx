import React from 'react';
import { Badge } from '@/components/ui/badge';

interface ExplorationBadgeProps {
  percentage: number;
}

export const ExplorationBadge: React.FC<ExplorationBadgeProps> = ({ percentage }) => {
  return (
    <Badge variant="secondary" className="fixed top-4 right-4 z-50 bg-purple-500/80 backdrop-blur-sm">
      {percentage.toFixed(4)}% explored
    </Badge>
  );
};