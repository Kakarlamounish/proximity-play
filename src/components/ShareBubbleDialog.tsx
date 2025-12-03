import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Share2, Copy, Check, Link, QrCode } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ShareBubbleDialogProps {
  bubbleId: string;
  bubbleName: string;
  isCreator: boolean;
}

export const ShareBubbleDialog: React.FC<ShareBubbleDialogProps> = ({
  bubbleId,
  bubbleName,
  isCreator
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const createInviteLink = async () => {
    if (!user || !isCreator) {
      toast({
        title: 'Permission denied',
        description: 'Only bubble creators can generate invite links',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const inviteCode = generateInviteCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      const { data, error } = await supabase
        .from('bubble_invites')
        .insert({
          bubble_id: bubbleId,
          invite_code: inviteCode,
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
          max_uses: 50,
        })
        .select()
        .single();

      if (error) throw error;

      const link = `${window.location.origin}/join/${inviteCode}`;
      setInviteLink(link);

      toast({
        title: 'Invite link created!',
        description: 'Share this link with others to invite them',
      });
    } catch (error: any) {
      console.error('Error creating invite link:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create invite link',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Invite link copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const shareNative = async () => {
    if (!inviteLink) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${bubbleName}`,
          text: `You've been invited to join the "${bubbleName}" bubble!`,
          url: inviteLink,
        });
      } catch (error) {
        console.log('Share cancelled or failed:', error);
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Share bubble">
          <Share2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share "{bubbleName}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isCreator ? (
            <p className="text-muted-foreground text-sm">
              Only the bubble creator can generate invite links.
            </p>
          ) : !inviteLink ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground text-sm">
                Generate an invite link to share this bubble with others. The link will expire in 7 days.
              </p>
              <Button onClick={createInviteLink} disabled={loading} className="w-full">
                <Link className="h-4 w-4 mr-2" />
                {loading ? 'Generating...' : 'Generate Invite Link'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Invite Link</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={inviteLink}
                    readOnly
                    className="bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyToClipboard}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={shareNative} className="flex-1">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button variant="outline" onClick={createInviteLink} disabled={loading}>
                  <Link className="h-4 w-4 mr-2" />
                  New Link
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                This link expires in 7 days and can be used up to 50 times.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
