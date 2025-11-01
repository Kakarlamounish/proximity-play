import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface PrivacyScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  initialSchedule?: { start: string; end: string } | null;
}

const PrivacyScheduleDialog: React.FC<PrivacyScheduleDialogProps> = ({ open, onClose, userId, initialSchedule }) => {
  const [start, setStart] = useState(initialSchedule?.start || "08:00");
  const [end, setEnd] = useState(initialSchedule?.end || "22:00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    const { error: dbError } = await supabase.from("privacy_schedules").upsert({
      user_id: userId,
      start_time: start,
      end_time: end,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (dbError) {
      setError("Failed to save schedule");
    } else {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogHeader>
        <DialogTitle>Privacy Scheduling</DialogTitle>
      </DialogHeader>
      <DialogContent>
        <div className="space-y-4">
          <label className="block text-sm font-medium">Start Time</label>
          <input type="time" value={start} onChange={e => setStart(e.target.value)} className="border rounded px-2 py-1 w-32" />
          <label className="block text-sm font-medium">End Time</label>
          <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="border rounded px-2 py-1 w-32" />
          {error && <div className="text-red-500 text-sm">{error}</div>}
          {success && <div className="text-green-600 text-sm">Saved!</div>}
          <Button type="button" onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Schedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrivacyScheduleDialog;
