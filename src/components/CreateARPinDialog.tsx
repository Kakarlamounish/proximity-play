import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { User } from '@supabase/supabase-js';

interface CreateARPinDialogProps {
  open: boolean;
  onClose: () => void;
  userLocation: [number, number] | null;
}

const CreateARPinDialog: React.FC<CreateARPinDialogProps> = ({ open, onClose, userLocation }) => {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get user_id from Supabase auth
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    fetchUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userLocation) {
      setError("Location missing");
      return;
    }
    if (!user || !user.id) {
      setError("User not authenticated");
      return;
    }
    setLoading(true);
    setError(null);
    // @ts-expect-error - ar_pins table not yet created in database
    const { error: dbError } = await supabase.from("ar_pins").insert({
      user_id: user.id,
      note,
      latitude: userLocation[0],
      longitude: userLocation[1],
      created_at: new Date().toISOString(),
    });
    if (dbError) {
      setError("Failed to drop AR pin");
    } else {
      setNote("");
      onClose();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogHeader>
        <DialogTitle>Drop AR Pin / Note</DialogTitle>
      </DialogHeader>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="Leave a note for others to discover..."
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
          />
          {error && <div className="text-red-500 text-sm">{error}</div>}
          <Button type="submit" disabled={loading || !userLocation}>
            {loading ? "Dropping..." : "Drop AR Pin"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateARPinDialog;
