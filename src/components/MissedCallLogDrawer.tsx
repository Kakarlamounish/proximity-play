import { useEffect, useMemo, useState } from 'react';
import { Phone, PhoneMissed } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

type MissedCallNotification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  data: any;
};

type Profile = {
  id: string;
  first_name: string;
  profile_photo_url: string | null;
};

type Bubble = {
  id: string;
  name: string;
};

interface MissedCallLogDrawerProps {
  onCallBack: (target: { friendId?: string; bubbleId?: string; callType: 'audio' | 'video' }) => void;
}

export function MissedCallLogDrawer({ onCallBack }: MissedCallLogDrawerProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MissedCallNotification[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [bubbles, setBubbles] = useState<Record<string, Bubble>>({});
  const [loading, setLoading] = useState(false);

  const unreadCount = useMemo(() => items.filter(i => !i.read).length, [items]);

  useEffect(() => {
    if (!open || !user) return;

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('id, title, body, read, created_at, data')
          .eq('user_id', user.id)
          .eq('type', 'missed_call')
          .order('created_at', { ascending: false })
          .limit(20);
        if (error) throw error;

        const list = (data || []) as MissedCallNotification[];
        setItems(list);

        // Hydrate caller profiles + bubble names.
        const callerIds = Array.from(
          new Set(list.map(n => n.data?.callerId).filter(Boolean))
        ) as string[];
        const bubbleIds = Array.from(
          new Set(list.map(n => n.data?.bubbleId).filter(Boolean))
        ) as string[];

        if (callerIds.length) {
          const { data: p } = await supabase
            .from('profiles')
            .select('id, first_name, profile_photo_url')
            .in('id', callerIds);
          const map: Record<string, Profile> = {};
          (p || []).forEach(pp => (map[pp.id] = pp as Profile));
          setProfiles(map);
        }

        if (bubbleIds.length) {
          const { data: b } = await supabase
            .from('bubbles')
            .select('id, name')
            .in('id', bubbleIds);
          const map: Record<string, Bubble> = {};
          (b || []).forEach(bb => (map[bb.id] = bb as Bubble));
          setBubbles(map);
        }
      } catch (e) {
        console.error('Failed to load missed calls', e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, user]);

  const markAsSeen = async (id: string) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, read: true } : i)));
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <PhoneMissed className="h-4 w-4" />
          Missed calls
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-1">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Missed calls</SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No missed calls.</div>
          ) : (
            <div className="space-y-2">
              {items.map((n) => {
                const callType = (n.data?.callType as 'audio' | 'video') || 'audio';
                const callerId = n.data?.callerId as string | undefined;
                const bubbleId = n.data?.bubbleId as string | undefined;
                const caller = callerId ? profiles[callerId] : undefined;
                const bubble = bubbleId ? bubbles[bubbleId] : undefined;
                const title = bubble ? `${bubble.name} (bubble)` : (caller?.first_name || 'Unknown');

                return (
                  <div
                    key={n.id}
                    className={`rounded-lg border p-3 ${
                      n.read ? 'bg-card border-border' : 'bg-primary/5 border-primary/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={caller?.profile_photo_url || undefined} />
                        <AvatarFallback>
                          {(caller?.first_name?.[0] || '?').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{title}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {callType} •{' '}
                              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          {!n.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => markAsSeen(n.id)}
                            >
                              Mark seen
                            </Button>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-end">
                          <Button
                            size="sm"
                            onClick={() => {
                              markAsSeen(n.id);
                              onCallBack({ friendId: callerId, bubbleId, callType });
                              setOpen(false);
                            }}
                            disabled={!callerId && !bubbleId}
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            Call back
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
