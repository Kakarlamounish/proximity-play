import { useEffect, useState } from 'react';
import { useSmartStatus } from '@/hooks/useSmartStatus';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, X } from 'lucide-react';
import { haptic } from '@/lib/haptics';

/**
 * Floating chip that suggests a status based on the user's movement.
 * Tapping it posts a status update; X dismisses for the session.
 */
export function SmartStatusChip() {
  const { user } = useAuth();
  const { toast } = useToast();
  const suggestion = useSmartStatus();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [posting, setPosting] = useState(false);
  const [lastPostedKey, setLastPostedKey] = useState<string | null>(null);

  useEffect(() => {
    if (suggestion) haptic('selection');
  }, [suggestion?.key]);

  if (!user || !suggestion) return null;
  if (dismissed.has(suggestion.key)) return null;
  if (lastPostedKey === suggestion.key) return null;

  const accept = async () => {
    setPosting(true);
    haptic('success');
    try {
      const { error } = await supabase.from('status_updates').insert({
        user_id: user.id,
        content: `${suggestion.emoji} ${suggestion.label}`,
        mood: suggestion.key,
      });
      if (error) throw error;
      toast({ title: 'Status updated', description: `${suggestion.emoji} ${suggestion.label}` });
      setLastPostedKey(suggestion.key);
    } catch (err: any) {
      toast({ title: "Couldn't update status", description: err.message, variant: 'destructive' });
    } finally {
      setPosting(false);
    }
  };

  const dismiss = () => {
    haptic('light');
    setDismissed((prev) => new Set(prev).add(suggestion.key));
  };

  return (
    <Card className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg border bg-card/95 backdrop-blur animate-in fade-in slide-in-from-bottom-4">
      <Sparkles className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium whitespace-nowrap">
        {suggestion.emoji} {suggestion.label}?
      </span>
      <Button size="sm" className="h-7 rounded-full px-3" onClick={accept} disabled={posting}>
        Set
      </Button>
      <button
        onClick={dismiss}
        className="p-1 rounded-full hover:bg-muted text-muted-foreground"
        aria-label="Dismiss suggestion"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </Card>
  );
}
