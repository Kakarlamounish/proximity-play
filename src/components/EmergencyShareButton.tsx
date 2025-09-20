import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface EmergencyShareButtonProps {
  userLocation: [number, number] | null;
  userId: string;
}

const EmergencyShareButton: React.FC<EmergencyShareButtonProps> = ({ userLocation, userId }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShare = async () => {
    if (!userLocation) {
      setError("Location unavailable");
      return;
    }
    setLoading(true);
    setError(null);
    // For demo: insert emergency share into a table (could trigger notification in real app)
    const { error: dbError } = await supabase.from("emergency_shares").insert({
      user_id: userId,
      latitude: userLocation[0],
      longitude: userLocation[1],
      shared_at: new Date().toISOString(),
    });
    if (dbError) {
      setError("Failed to share location");
    } else {
      setSuccess(true);
      setTimeout(() => setOpen(false), 2000);
    }
    setLoading(false);
  };

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Emergency Share
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>Share Live Location (Emergency)</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Your live location will be shared with trusted contacts.</p>
            {error && <div className="text-red-500 text-sm">{error}</div>}
            {success && <div className="text-green-600 text-sm">Location shared!</div>}
            <Button type="button" variant="destructive" disabled={loading || success} onClick={handleShare}>
              {loading ? "Sharing..." : "Confirm Share"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmergencyShareButton;
