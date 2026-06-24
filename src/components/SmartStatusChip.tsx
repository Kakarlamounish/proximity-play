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
  
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('dismissed_smart_status');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  });
  
  const [posting, setPosting] = useState(false);
  const [lastPostedKey, setLastPostedKey] = useState<string | null>(null);

  useEffect(() => {
    if (suggestion) haptic('selection');
  }, [suggestion?.key]);

  // Sync state if other tabs change it
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'dismissed_smart_status' && e.newValue) {
        try {
          setDismissed(JSON.parse(e.newValue));
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (!user || !suggestion) return null;
  if (lastPostedKey === suggestion.key) return null;
  
  // Check if dismissed within the last 12 hours
  if (dismissed[suggestion.key]) {
    const age = Date.now() - dismissed[suggestion.key];
    if (age < 12 * 60 * 60 * 1000) return null;
  }

  const accept = async () => {
    setPosting(true);
    haptic('success');
    try {
      const newBio = `${suggestion.emoji} ${suggestion.label}`;
      const { error } = await supabase
        .from('profiles')
        .update({ bio: newBio, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      toast({ title: 'Status updated', description: newBio });
      setLastPostedKey(suggestion.key);
    } catch (err: any) {
      toast({ title: "Couldn't update status", description: err.message, variant: 'destructive' });
    } finally {
      setPosting(false);
    }
  };

  const dismiss = () => {
    haptic('light');
    setDismissed((prev) => {
      const next = { ...prev, [suggestion.key]: Date.now() };
      localStorage.setItem('dismissed_smart_status', JSON.stringify(next));
      return next;
    });
  };

  return (
    <Card className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg border glass animate-in fade-in slide-in-from-bottom-4">
      <Sparkles className="h-4 w-4 text-primary" />
      <span className="text-sm font-bold whitespace-nowrap drop-shadow-sm">
        {suggestion.emoji} {suggestion.label}?
      </span>
      <Button size="sm" className="h-8 rounded-full px-4 font-bold shadow-md" onClick={accept} disabled={posting}>
        Set
      </Button>
      <button
        onClick={dismiss}
        className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"
        aria-label="Dismiss suggestion"
      >
        <X className="h-4 w-4" />
      </button>
    </Card>
  );
}
