import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

interface CreateEventDialogProps {
  open: boolean;
  onClose: () => void;
  userLocation: [number, number] | null;
  bubbleId: string;
}

const CreateEventDialog: React.FC<CreateEventDialogProps> = ({ open, onClose, userLocation, bubbleId }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userLocation || !bubbleId) {
      setError("Location or bubble missing");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: dbError } = await supabase.from("meetups").insert({
      bubble_id: bubbleId,
      title,
      description,
      date_time: date,
      latitude: userLocation[0],
      longitude: userLocation[1],
      organizer_id: user?.id ?? "",
    });
    if (dbError) {
      setError("Failed to create event");
    } else {
      setTitle("");
      setDescription("");
      setDate("");
      onClose();
    }
    setLoading(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onClose}>
      <ResponsiveDialogContent className="sm:max-w-md p-4 pt-8">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Create Event / Meetup</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Event Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
          />
          <Input
            type="datetime-local"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          {error && <div className="text-red-500 text-sm">{error}</div>}
          <Button type="submit" disabled={loading || !userLocation} className="w-full">
            {loading ? "Creating..." : "Create Event"}
          </Button>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};

export default CreateEventDialog;
