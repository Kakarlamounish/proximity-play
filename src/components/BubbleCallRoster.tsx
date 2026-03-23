import React, { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Participant = {
  userId: string;
  name: string;
  avatarUrl?: string;
  joinedAt: number;
  isSpeaking: boolean;
};

interface BubbleCallRosterProps {
  bubbleId: string;
}

export const BubbleCallRoster: React.FC<BubbleCallRosterProps> = ({ bubbleId }) => {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`bubble-roster-${bubbleId}`, {
      config: { presence: { key: user.id } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, Array<{ name: string; avatarUrl?: string; joinedAt: number }>>;
      const list: Participant[] = [];
      for (const [userId, presences] of Object.entries(state)) {
        const p = presences[0];
        if (p) {
          list.push({ userId, name: p.name, avatarUrl: p.avatarUrl, joinedAt: p.joinedAt, isSpeaking: false });
        }
      }
      list.sort((a, b) => a.joinedAt - b.joinedAt);
      setParticipants(list);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'You',
          avatarUrl: user.user_metadata?.avatar_url,
          joinedAt: Date.now(),
        });
      }
    });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [bubbleId, user]);

  if (participants.length === 0) return null;

  return (
    <div className="absolute top-[80px] left-3 z-20 w-56">
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className="flex items-center gap-2 rounded-t-lg border border-border/40 bg-card/60 backdrop-blur px-3 py-1.5 text-xs font-medium text-foreground w-full"
      >
        <Users className="h-3.5 w-3.5" />
        {participants.length} in call
      </button>
      {!collapsed && (
        <ScrollArea className="max-h-48 rounded-b-lg border border-t-0 border-border/40 bg-card/60 backdrop-blur">
          <div className="p-2 space-y-1">
            {participants.map(p => (
              <div key={p.userId} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent/30">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={p.avatarUrl} />
                  <AvatarFallback className="text-[10px]">{p.name[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-xs truncate flex-1">{p.name}</span>
                {p.isSpeaking && <Volume2 className="h-3 w-3 text-primary animate-pulse" />}
                {p.userId === user?.id && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">You</Badge>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
