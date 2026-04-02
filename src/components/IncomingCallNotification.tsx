/**
 * IncomingCallNotification
 *
 * Reliability strategy (belt + suspenders):
 *  1. Supabase realtime INSERT on call_logs (fastest, may fail silently)
 *  2. Polling fallback every 3 s — queries for any 'ringing' call addressed
 *     to the current user that started in the last 90 s
 *  3. Browser Notification API — fires even when the tab is not focused,
 *     mimicking WhatsApp's "incoming call" system notification
 *
 * UX:
 *  - Slides in from the top of the screen (WhatsApp-style) with a full-screen
 *    dark overlay so it covers every page regardless of route.
 *  - Snapchat yellow Accept button, red Decline button, clear labels.
 *  - Avatar ring pulses continuously while ringing.
 *  - Auto-dismisses when the caller hangs up (realtime UPDATE watcher).
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRingtone } from '@/hooks/useRingtone';

interface IncomingCall {
  id: string;
  caller_id: string;
  call_type: 'audio' | 'video';
  caller_name: string;
  caller_avatar?: string;
}

interface Props {
  onAccept: (callId: string, callType: 'audio' | 'video', callerId: string) => void;
  onDecline: (callId: string) => void;
}

// Request browser notification permission once on mount
function requestNotificationPermission() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

// Fire a browser-level notification (shows even if tab is backgrounded)
function fireBrowserNotification(callType: 'audio' | 'video', callerName: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(`Incoming ${callType} call`, {
      body: `${callerName} is calling you…`,
      icon: '/logo.svg',
      tag: 'incoming-call',
      renotify: true,
      requireInteraction: true,
    } as any);
    // Clicking the notification focuses the tab
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* Safari, etc. */ }
}

export const IncomingCallNotification: React.FC<Props> = ({ onAccept, onDecline }) => {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const { startRinging, stopRinging, playOnce } = useRingtone();

  // Track processed call IDs so polling doesn't re-trigger already-seen calls
  const seenIds = useRef<Set<string>>(new Set());
  // Keep a ref so the status-watcher always reads the latest call
  const callRef = useRef<IncomingCall | null>(null);
  useEffect(() => { callRef.current = incomingCall; }, [incomingCall]);

  // ── helper: take a raw call_log record and resolve caller profile ──
  const resolveCall = useCallback(async (call: {
    id: string;
    caller_id: string;
    call_type: 'audio' | 'video';
  }): Promise<IncomingCall> => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, profile_photo_url')
      .eq('id', call.caller_id)
      .maybeSingle();
    return {
      id: call.id,
      caller_id: call.caller_id,
      call_type: call.call_type,
      caller_name: profile?.first_name || 'Unknown',
      caller_avatar: profile?.profile_photo_url || undefined,
    };
  }, []);

  // ── show a call (deduplicate) ──
  const showCall = useCallback(async (raw: { id: string; caller_id: string; call_type: 'audio' | 'video' }) => {
    if (seenIds.current.has(raw.id)) return;
    seenIds.current.add(raw.id);
    const resolved = await resolveCall(raw);
    setIncomingCall(resolved);
    fireBrowserNotification(resolved.call_type, resolved.caller_name);
  }, [resolveCall]);

  // ── Strategy 1: Supabase realtime INSERT ──
  useEffect(() => {
    if (!user) return;
    requestNotificationPermission();

    const channel = supabase
      .channel(`incoming-calls-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'call_logs', filter: `receiver_id=eq.${user.id}` },
        async (payload: any) => {
          const call = payload.new;
          if (call.status === 'ringing' || call.status === 'pending') {
            await showCall({ id: call.id, caller_id: call.caller_id, call_type: call.call_type });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, showCall]);

  // ── Strategy 2: Polling fallback every 3 s ──
  // Catches cases where realtime delivery failed (RLS, network blip, cold tab)
  useEffect(() => {
    if (!user) return;

    const poll = async () => {
      // Only look for calls in the last 90 seconds that are still 'ringing'
      const since = new Date(Date.now() - 90_000).toISOString();
      const { data } = await supabase
        .from('call_logs')
        .select('id, caller_id, call_type, status')
        .eq('receiver_id', user.id)
        .eq('status', 'ringing')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const call = data[0];
        await showCall({ id: call.id, caller_id: call.caller_id, call_type: call.call_type });
      }
    };

    // Immediate first poll (so a missed realtime INSERT catches up fast)
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [user, showCall]);

  // ── Strategy 3: Status watcher — auto-dismiss when caller hangs up ──
  useEffect(() => {
    if (!incomingCall) return;

    const statusChannel = supabase
      .channel(`call-status-${incomingCall.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'call_logs', filter: `id=eq.${incomingCall.id}` },
        (payload: any) => {
          const s = payload?.new?.status;
          if (s && s !== 'ringing' && s !== 'pending') {
            stopRinging();
            setIncomingCall(null);
            // Close any browser notification
            if (typeof Notification !== 'undefined') {
              new Notification('', { tag: 'incoming-call' }).close();
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(statusChannel); };
  }, [incomingCall, stopRinging]);

  // ── Ring while notification is visible ──
  useEffect(() => {
    if (incomingCall) { startRinging('incoming'); }
    else { stopRinging(); }
    return () => stopRinging();
  }, [incomingCall, startRinging, stopRinging]);

  // ── Accept ──
  const handleAccept = async () => {
    if (!incomingCall) return;
    stopRinging();
    await supabase
      .from('call_logs')
      .update({ status: 'connected', started_at: new Date().toISOString() })
      .eq('id', incomingCall.id);
    onAccept(incomingCall.id, incomingCall.call_type, incomingCall.caller_id);
    setIncomingCall(null);
  };

  // ── Decline ──
  const handleDecline = async () => {
    if (!incomingCall) return;
    stopRinging();
    playOnce('hangup');
    onDecline(incomingCall.id);
    setIncomingCall(null);
  };

  if (!incomingCall) return null;

  const isVideo = incomingCall.call_type === 'video';
  const initials = incomingCall.caller_name[0]?.toUpperCase() || '?';

  return (
    <>
      {/* ── Dark overlay — covers the entire screen ── */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)' }}
        aria-hidden="true"
      />

      {/* ── Call card — slides down from top (WhatsApp style) ── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Incoming ${incomingCall.call_type} call from ${incomingCall.caller_name}`}
        className="fixed inset-x-0 top-0 z-[9999] flex justify-center px-4 pt-6 pb-4"
        style={{ animation: 'slideInFromTop 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        <div
          className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
          style={{
            background: 'linear-gradient(160deg, #111111 0%, #1c1c1c 100%)',
            border: '1.5px solid rgba(255,212,0,0.25)',
          }}
        >
          {/* ── Monochrome top stripe ── */}
          <div
            className="h-1 w-full bg-primary"
          />

          <div className="px-6 py-7 flex flex-col items-center gap-5">
            {/* Ghost + app label */}
            <div className="flex items-center gap-1.5">
              <span className="text-xl" aria-hidden="true">👻</span>
              <span className="text-xs font-bold tracking-widest uppercase text-primary">
                {isVideo ? 'Video Call' : 'Audio Call'}
              </span>
            </div>

            {/* Avatar with pulsing rings */}
            <div className="relative flex items-center justify-center" style={{ width: 112, height: 112 }}>
              {/* Outer pulse ring */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  border: '2px solid hsl(var(--primary) / 0.4)',
                  animation: 'ringPulse 1.6s ease-out infinite',
                }}
              />
              {/* Middle pulse ring */}
              <div
                className="absolute rounded-full"
                style={{
                  inset: 10,
                  border: '2px solid hsl(var(--primary) / 0.55)',
                  animation: 'ringPulse 1.6s ease-out infinite 0.4s',
                }}
              />
              {incomingCall.caller_avatar ? (
                <img
                  src={incomingCall.caller_avatar}
                  alt={incomingCall.caller_name}
                  className="rounded-full object-cover"
                  style={{ width: 84, height: 84, border: '3px solid hsl(var(--primary))' }}
                />
              ) : (
                <div
                  className="rounded-full flex items-center justify-center text-3xl font-extrabold text-primary-foreground bg-primary"
                  style={{ width: 84, height: 84, border: '3px solid hsl(var(--primary))' }}
                >
                  {initials}
                </div>
              )}
            </div>

            {/* Caller name + status */}
            <div className="text-center">
              <p className="text-white text-xl font-bold leading-tight">{incomingCall.caller_name}</p>
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {isVideo ? 'Incoming video call' : 'Incoming audio call'}
                </span>
                {/* Animated ringing dots */}
                {[0, 180, 360].map((delay) => (
                  <span
                    key={delay}
                    className="w-1 h-1 rounded-full bg-primary"
                    style={{
                      animation: `dotBounce 1.2s ease-in-out infinite ${delay}ms`,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-end gap-12 pt-1">
              {/* Decline */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={handleDecline}
                  className="flex items-center justify-center rounded-full transition-all duration-150 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  style={{
                    width: 64,
                    height: 64,
                    background: '#FF3B30',
                    boxShadow: '0 6px 24px rgba(255,59,48,0.45)',
                  }}
                  aria-label="Decline call"
                >
                  <PhoneOff className="w-7 h-7 text-white" />
                </button>
                <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Decline</span>
              </div>

              {/* Accept */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={handleAccept}
                  className="flex items-center justify-center rounded-full transition-all duration-150 active:scale-90 focus:outline-none focus-visible:ring-2 bg-primary text-primary-foreground shadow-[0_6px_24px_hsl(var(--primary)/0.55)]"
                  style={{
                    width: 64,
                    height: 64,
                    // @ts-ignore
                    '--tw-ring-color': 'hsl(var(--primary))',
                  }}
                  aria-label="Accept call"
                >
                  {isVideo
                    ? <Video className="w-7 h-7" />
                    : <Phone className="w-7 h-7" />
                  }
                </button>
                <span className="text-xs font-semibold text-primary">
                  {isVideo ? 'Accept' : 'Answer'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Keyframe animations (injected inline) ── */}
      <style>{`
        @keyframes slideInFromTop {
          from { opacity: 0; transform: translateY(-120%) scale(0.92); }
          to   { opacity: 1; transform: translateY(0)      scale(1); }
        }
        @keyframes ringPulse {
          0%   { transform: scale(1);    opacity: 0.9; }
          70%  { transform: scale(1.55); opacity: 0;   }
          100% { transform: scale(1.55); opacity: 0;   }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0);   opacity: 0.5; }
          40%            { transform: translateY(-5px); opacity: 1;   }
        }
      `}</style>
    </>
  );
};
