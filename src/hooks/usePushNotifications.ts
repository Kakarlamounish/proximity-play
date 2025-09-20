import { useEffect } from "react";

export function usePushNotifications({ enabled, message }: { enabled: boolean; message: string }) {
  useEffect(() => {
    if (!enabled || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(message);
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification(message);
        }
      });
    }
  }, [enabled, message]);
}
