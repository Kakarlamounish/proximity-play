import React, { createContext, useContext, useState, useRef, ReactNode, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRingtone } from '@/hooks/useRingtone';
import { VideoCall } from '@/components/VideoCall';
import { IncomingCallNotification } from '@/components/IncomingCallNotification';

export interface ActiveCallState {
  bubbleId?: string;
  friendId?: string;
  type: 'audio' | 'video';
  isInitiator: boolean;
  callLogId?: string;
}

interface CallerProfile {
  id: string;
  first_name: string;
  profile_photo_url: string | null;
}

interface CallContextType {
  activeCall: ActiveCallState | null;
  startCall: (targetId: string, type: 'audio' | 'video', isBubble: boolean) => Promise<void>;
  acceptCall: (callId: string, callType: 'audio' | 'video', callerId: string) => void;
  declineCall: (callId: string) => void;
  endCall: () => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCallContext = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCallContext must be used within a CallProvider');
  }
  return context;
};

const CALL_TIMEOUT_STORAGE_KEY = 'call-timeout-seconds';

// FIX #11: wrapped in try/catch so private-browsing localStorage doesn't throw
const getCallTimeoutSeconds = (): number => {
  try {
    const raw = localStorage.getItem(CALL_TIMEOUT_STORAGE_KEY);
    const n = raw ? Number(raw) : 30;
    return Number.isFinite(n) && n > 0 ? n : 30;
  } catch {
    return 30;
  }
};

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { startRinging: startOutgoingRing, stopRinging: stopOutgoingRing } = useRingtone();

  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [callerProfile, setCallerProfile] = useState<CallerProfile | null>(null);
  const [bubbleInfo, setBubbleInfo] = useState<{ id: string; name: string } | null>(null);

  // FIX #3: shadow activeCall in a ref so endCall never closes over stale state
  const activeCallRef = useRef<ActiveCallState | null>(null);
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // FIX #1: track the call-timeout channel so we can clean it up from endCall
  const timeoutChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const createMissedCallNotification = async (args: {
    receiverId: string;
    callerId: string;
    callType: 'audio' | 'video';
    callLogId: string;
    bubbleId?: string | null;
  }) => {
    const { receiverId, callerId, callType, callLogId, bubbleId } = args;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', callerId)
        .maybeSingle();

      await supabase.from('notifications').insert({
        user_id: receiverId,
        type: 'missed_call',
        title: 'Missed call',
        body: `From ${profile?.first_name || 'Unknown'} • ${callType}`,
        read: false,
        data: {
          callLogId,
          callerId,
          bubbleId: bubbleId ?? null,
          callType,
        },
      });
    } catch (e) {
      console.error('Failed to create missed call notification', e);
    }
  };

  const startCall = useCallback(async (targetId: string, type: 'audio' | 'video', isBubble: boolean) => {
    if (!user) return;

    // Play outgoing ring synchronously before any awaits to bypass Safari/Chrome autoplay restrictions
    startOutgoingRing('outgoing');

    try {
      if (!isBubble) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, first_name, profile_photo_url')
          .eq('id', targetId)
          .maybeSingle();
        setCallerProfile(profile);
      } else {
        const { data: bubble } = await supabase
          .from('bubbles')
          .select('id, name')
          .eq('id', targetId)
          .maybeSingle();
        setBubbleInfo({ id: targetId, name: bubble?.name || 'Bubble call' });
      }

      const { data: callLog, error } = await supabase
        .from('call_logs')
        .insert({
          caller_id: user.id,
          receiver_id: isBubble ? null : targetId,
          bubble_id: isBubble ? targetId : null,
          call_type: type,
          status: 'ringing'
        })
        .select()
        .single();

      if (error) {
        // Stop ringing if we failed to create the call
        stopOutgoingRing();
        throw error;
      }

      if (isBubble) {
        setActiveCall({ bubbleId: targetId, type, isInitiator: true, callLogId: callLog.id });
      } else {
        setActiveCall({ friendId: targetId, type, isInitiator: true, callLogId: callLog.id });

        const timeoutSeconds = getCallTimeoutSeconds();
        const callId = callLog.id;
        const receiverId = targetId;

        const timeoutHandle = window.setTimeout(async () => {
          const { data: latest } = await supabase
            .from('call_logs')
            .select('status')
            .eq('id', callId)
            .maybeSingle();
          if (!latest || latest.status !== 'ringing') return;

          const endedAt = new Date().toISOString();
          await supabase
            .from('call_logs')
            .update({ status: 'missed', ended_at: endedAt })
            .eq('id', callId);

          await createMissedCallNotification({
            receiverId,
            callerId: user.id,
            callType: type,
            callLogId: callId,
            bubbleId: null,
          });
          setActiveCall(null);
        }, timeoutSeconds * 1000);

        // FIX #1: store channel ref so endCall can clean it up
        const callChannel = supabase
          .channel(`call-timeout-${callId}-${user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'call_logs', filter: `id=eq.${callId}` },
            (payload: any) => {
              const updated = payload?.new;
              if (updated && updated.status !== 'ringing') {
                window.clearTimeout(timeoutHandle);
                supabase.removeChannel(callChannel);
                timeoutChannelRef.current = null;
              }
            }
          )
          .subscribe();

        timeoutChannelRef.current = callChannel;
      }

      toast({
        title: '📞 Calling...',
        description: `Ringing ${type} call — waiting for answer`,
      });

    } catch (error) {
      console.error('Error starting call:', error);
      stopOutgoingRing();
      toast({
        title: 'Error',
        description: 'Could not start call',
        variant: 'destructive',
      });
    }
  }, [user, toast, startOutgoingRing, stopOutgoingRing]);

  const acceptCall = useCallback(async (callId: string, callType: 'audio' | 'video', callerId: string) => {
    stopOutgoingRing(); // stop outgoing ring if caller accepts their own side
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, first_name, profile_photo_url')
      .eq('id', callerId)
      .maybeSingle();
    setCallerProfile(profile);
    setActiveCall({ friendId: callerId, type: callType, isInitiator: false, callLogId: callId });
  }, [stopOutgoingRing]);

  // FIX #2: declineCall now writes to Supabase
  const declineCall = useCallback(async (callId: string) => {
    stopOutgoingRing(); // stop outgoing ring if receiver declines
    try {
      await supabase
        .from('call_logs')
        .update({ status: 'declined', ended_at: new Date().toISOString() })
        .eq('id', callId);
    } catch (e) {
      console.error('Failed to mark call as declined', e);
    }
    toast({
      title: 'Call Declined',
      description: 'You declined the incoming call',
    });
  }, [toast, stopOutgoingRing]);

  // FIX #3: reads from activeCallRef so the closure never goes stale
  const endCall = useCallback(async () => {
    if (!user) return;

    // FIX #1: clean up any lingering timeout channel
    if (timeoutChannelRef.current) {
      try {
        supabase.removeChannel(timeoutChannelRef.current);
      } catch {}
      timeoutChannelRef.current = null;
    }

    const currentCall = activeCallRef.current; // always fresh

    if (currentCall?.callLogId) {
      const { data: c } = await supabase
        .from('call_logs')
        .select('id, receiver_id, status, caller_id')
        .eq('id', currentCall.callLogId)
        .maybeSingle();

      if (c && c.status === 'ringing') {
        const endedAt = new Date().toISOString();
        await supabase
          .from('call_logs')
          .update({
            status: c.receiver_id ? 'missed' : 'ended',
            ended_at: endedAt,
          })
          .eq('id', c.id);

        if (c.receiver_id && c.caller_id === user.id) {
          await createMissedCallNotification({
            receiverId: c.receiver_id,
            callerId: user.id,
            callType: currentCall.type,
            callLogId: c.id,
            bubbleId: null,
          });
        }
      }
    }

    stopOutgoingRing(); // always stop outgoing ring when ending
    setActiveCall(null);
    setCallerProfile(null);
    setBubbleInfo(null);
  }, [user, stopOutgoingRing]); // removed activeCall from deps — using ref instead

  return (
    <CallContext.Provider value={{ activeCall, startCall, acceptCall, declineCall, endCall }}>
      {children}
      <IncomingCallNotification onAccept={acceptCall} onDecline={declineCall} />
      
      {activeCall && (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
          <VideoCall
            bubbleId={activeCall.bubbleId || activeCall.friendId || ''}
            callType={activeCall.type}
            isInitiator={activeCall.isInitiator}
            callLogId={activeCall.callLogId}
            identity={
              activeCall.bubbleId && bubbleInfo
                ? {
                    kind: 'bubble',
                    title: bubbleInfo.name || 'Bubble call',
                  }
                : {
                    kind: 'direct',
                    title: callerProfile?.first_name || 'Call',
                    avatarUrl: callerProfile?.profile_photo_url || undefined,
                  }
            }
            onCallEnd={endCall}
          />
        </div>
      )}
    </CallContext.Provider>
  );
};
