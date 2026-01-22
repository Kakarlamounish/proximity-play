import React, { useEffect } from "react";
import { Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MissedCallBannerData {
  callId: string;
  callerId: string;
  callType: "audio" | "video";
  callerName?: string;
}

interface MissedCallBannerProps {
  data: MissedCallBannerData;
  onCallBack: (callerId: string, callType: "audio" | "video") => void;
  onDismiss: () => void;
  autoHideMs?: number;
}

export function MissedCallBanner({
  data,
  onCallBack,
  onDismiss,
  autoHideMs = 8000,
}: MissedCallBannerProps) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, autoHideMs);
    return () => window.clearTimeout(t);
  }, [autoHideMs, onDismiss]);

  return (
    <div className="fixed top-16 left-0 right-0 z-50 px-3 sm:px-4">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">Missed call</p>
          <p className="text-xs text-muted-foreground truncate">
            From {data.callerName || "Unknown"} • {data.callType}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => onCallBack(data.callerId, data.callType)}
          >
            <Phone className="h-4 w-4 mr-2" />
            Call back
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
