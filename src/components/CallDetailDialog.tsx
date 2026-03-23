import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Video, Clock, Calendar, Info } from 'lucide-react';
import { format } from 'date-fns';

interface Profile {
  id: string;
  first_name: string;
  profile_photo_url: string | null;
}

interface CallLog {
  id: string;
  caller_id: string;
  receiver_id: string | null;
  bubble_id: string | null;
  call_type: 'audio' | 'video';
  status: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
}

interface CallDetailDialogProps {
  log: CallLog;
  currentUserId: string;
  profiles: Record<string, Profile>;
  children: React.ReactNode;
}

const formatDuration = (s: number | null) => {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const statusVariant = (status: string) => {
  switch (status) {
    case 'ended': return 'secondary' as const;
    case 'missed': return 'destructive' as const;
    case 'declined': return 'destructive' as const;
    default: return 'outline' as const;
  }
};

export const CallDetailDialog: React.FC<CallDetailDialogProps> = ({ log, currentUserId, profiles, children }) => {
  const isOutgoing = log.caller_id === currentUserId;
  const caller = profiles[log.caller_id];
  const receiver = log.receiver_id ? profiles[log.receiver_id] : null;

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {log.call_type === 'video' ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
            Call Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
          </div>

          {/* Type */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Type</span>
            <span className="text-sm font-medium capitalize">{log.call_type} • {isOutgoing ? 'Outgoing' : 'Incoming'}</span>
          </div>

          {/* Participants */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Participants</p>
            <div className="space-y-2">
              {caller && (
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={caller.profile_photo_url || undefined} />
                    <AvatarFallback>{caller.first_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{caller.first_name}</span>
                  <Badge variant="outline" className="text-xs ml-auto">Caller</Badge>
                </div>
              )}
              {receiver && (
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={receiver.profile_photo_url || undefined} />
                    <AvatarFallback>{receiver.first_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{receiver.first_name}</span>
                  <Badge variant="outline" className="text-xs ml-auto">Receiver</Badge>
                </div>
              )}
              {log.bubble_id && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  Bubble call (group)
                </div>
              )}
            </div>
          </div>

          {/* Duration */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="h-4 w-4" /> Duration</span>
            <span className="text-sm font-mono">{formatDuration(log.duration_seconds)}</span>
          </div>

          {/* Time */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1"><Calendar className="h-4 w-4" /> Date</span>
            <span className="text-sm">{format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}</span>
          </div>

          {/* Missed reason */}
          {(log.status === 'missed' || log.status === 'declined') && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive font-medium">
                {log.status === 'missed' ? 'Call was not answered (timed out)' : 'Call was declined by receiver'}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
