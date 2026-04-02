import { usePresence } from '@/hooks/usePresence';

/** Invisible component that keeps user presence alive. Mount once in App. */
export function PresenceTracker() {
  usePresence();
  return null;
}
