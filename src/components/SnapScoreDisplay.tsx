import React from 'react';
import { Ghost, Send, ArrowDown, BookOpen } from 'lucide-react';

interface SnapScoreDisplayProps {
  totalScore: number;
  snapsSent?: number;
  snapsReceived?: number;
  storiesPosted?: number;
  compact?: boolean;
}

export function SnapScoreDisplay({ totalScore, snapsSent, snapsReceived, storiesPosted, compact }: SnapScoreDisplayProps) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
        <Ghost className="h-3 w-3" />
        {totalScore.toLocaleString()}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-4 p-3 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-1.5">
        <Ghost className="h-5 w-5 text-primary" />
        <span className="text-xl font-extrabold text-primary">{totalScore.toLocaleString()}</span>
      </div>
      {(snapsSent !== undefined || snapsReceived !== undefined) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground border-l border-border pl-3">
          {snapsSent !== undefined && (
            <span className="flex items-center gap-1">
              <Send className="h-3 w-3" /> {snapsSent}
            </span>
          )}
          {snapsReceived !== undefined && (
            <span className="flex items-center gap-1">
              <ArrowDown className="h-3 w-3" /> {snapsReceived}
            </span>
          )}
          {storiesPosted !== undefined && (
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" /> {storiesPosted}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
