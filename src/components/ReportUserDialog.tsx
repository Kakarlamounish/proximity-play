import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReportUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportedUserId: string;
}

export const ReportUserDialog = ({ open, onOpenChange, reportedUserId }: ReportUserDialogProps) => {
  const [reason, setReason] = useState<string>("harassment");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("user_reports").insert([{
        reporter_id: user.id,
        reported_id: reportedUserId,
        reason: reason as any,
        description: description.trim() || null,
      }] as any);

      if (error) throw error;

      toast({
        title: "Report submitted",
        description: "Thank you for helping keep our community safe",
      });
      onOpenChange(false);
      setDescription("");
      setReason("harassment");
    } catch (error: any) {
      console.error("Report error:", error);
      toast({
        title: "Failed to submit report",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Report User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Reason for reporting</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="harassment" id="harassment" />
                <Label htmlFor="harassment" className="font-normal cursor-pointer">
                  Harassment or bullying
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="spam" id="spam" />
                <Label htmlFor="spam" className="font-normal cursor-pointer">
                  Spam
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="inappropriate_content" id="inappropriate" />
                <Label htmlFor="inappropriate" className="font-normal cursor-pointer">
                  Inappropriate content
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fake_profile" id="fake" />
                <Label htmlFor="fake" className="font-normal cursor-pointer">
                  Fake profile
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="other" />
                <Label htmlFor="other" className="font-normal cursor-pointer">
                  Other
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Additional details (optional)</Label>
            <Textarea
              id="description"
              placeholder="Provide more context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            Submit Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
