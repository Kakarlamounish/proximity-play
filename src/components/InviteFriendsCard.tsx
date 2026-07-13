import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gift, Copy, Check, Share2, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useReferralStore } from '@/stores/useReferralStore';

const TIER_LABEL: Record<string, string> = {
  bronze: '🥉 Bronze',
  silver: '🥈 Silver',
  gold: '🥇 Gold',
  platinum: '💎 Platinum',
};

export const InviteFriendsCard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { referrals, referralCode, getOrCreateCode, fetchReferrals, activateReferral, getStats } = useReferralStore();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      await Promise.all([getOrCreateCode(user.id), fetchReferrals(user.id)]);
      setLoading(false);
    })();
  }, [user, getOrCreateCode, fetchReferrals]);

  if (!user) return null;

  const stats = getStats(user.id);
  const link = referralCode ? `${window.location.origin}/?ref=${referralCode}` : '';

  const handleCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast({ title: 'Link copied!', description: 'Share it with a friend.' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Proximity Play',
          text: 'Come find your bubble on Proximity Play!',
          url: link,
        });
      } catch {
        // user cancelled the share sheet — no-op
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Card className="backdrop-blur-sm bg-card/95 border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Invite Friends
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 rounded-lg bg-muted text-sm truncate">
            {loading ? 'Loading…' : link}
          </code>
          <Button variant="outline" size="icon" onClick={handleCopy} disabled={loading}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button size="icon" onClick={handleShare} disabled={loading}>
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {stats.totalInvites} invited
            </span>
            <span>{stats.signups} signed up</span>
            <span>{stats.activeUsers} active</span>
          </div>
          <Badge variant="secondary">{TIER_LABEL[stats.rewardTier]}</Badge>
        </div>

        {referrals.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            {referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground truncate">{r.referredEmail}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={r.status === 'active' ? 'default' : 'outline'} className="text-xs">
                    {r.status.replace('_', ' ')}
                  </Badge>
                  {r.status === 'signed_up' && (
                    <Button size="sm" variant="ghost" onClick={() => activateReferral(r.id)}>
                      Mark active
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
