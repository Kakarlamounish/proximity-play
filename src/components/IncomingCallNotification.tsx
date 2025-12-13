import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRingtone } from '@/hooks/useRingtone';

interface IncomingCall {
  id: string;
  caller_id: string;
  call_type: 'audio' | 'video';
  caller_name?: string;
  caller_avatar?: string;
}

interface IncomingCallNotificationProps {
  onAccept: (callId: string, callType: 'audio' | 'video', callerId: string) => void;
  onDecline: (callId: string) => void;
}

export const IncomingCallNotification: React.FC<IncomingCallNotificationProps> = ({
  onAccept,
  onDecline
}) => {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const { startRinging, stopRinging, playOnce } = useRingtone();

  useEffect(() => {
    if (!user) return;

    // Listen for incoming calls
    const channel = supabase
      .channel('incoming-calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_logs',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload: any) => {
          const call = payload.new;
          if (call.status === 'pending' || call.status === 'ringing') {
            // Fetch caller info
            const { data: callerProfile } = await supabase
              .from('profiles')
              .select('first_name, profile_photo_url')
              .eq('id', call.caller_id)
              .maybeSingle();

            setIncomingCall({
              id: call.id,
              caller_id: call.caller_id,
              call_type: call.call_type,
              caller_name: callerProfile?.first_name || 'Unknown',
              caller_avatar: callerProfile?.profile_photo_url || undefined
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Start/stop ringing based on incoming call
  useEffect(() => {
    if (incomingCall) {
      startRinging('incoming');
    } else {
      stopRinging();
    }

    return () => {
      stopRinging();
    };
  }, [incomingCall, startRinging, stopRinging]);

  const handleAccept = async () => {
    if (!incomingCall) return;
    
    stopRinging();
    
    // Update call status
    await supabase
      .from('call_logs')
      .update({ status: 'connected', started_at: new Date().toISOString() })
      .eq('id', incomingCall.id);

    onAccept(incomingCall.id, incomingCall.call_type, incomingCall.caller_id);
    setIncomingCall(null);
  };

  const handleDecline = async () => {
    if (!incomingCall) return;
    
    stopRinging();
    playOnce('hangup');
    
    // Update call status
    await supabase
      .from('call_logs')
      .update({ status: 'declined', ended_at: new Date().toISOString() })
      .eq('id', incomingCall.id);

    onDecline(incomingCall.id);
    setIncomingCall(null);
  };

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-card rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-border animate-in zoom-in-95 duration-300">
        <div className="text-center">
          {/* Caller Avatar with Animation */}
          <div className="relative mx-auto w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-primary/30 animate-pulse" />
            <Avatar className="w-24 h-24 relative z-10 border-4 border-primary">
              <AvatarImage src={incomingCall.caller_avatar} />
              <AvatarFallback className="text-2xl bg-gradient-to-br from-secondary to-primary text-white">
                {incomingCall.caller_name?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Call Info */}
          <h2 className="text-xl font-bold mb-1">{incomingCall.caller_name}</h2>
          <p className="text-muted-foreground mb-8 flex items-center justify-center gap-2">
            {incomingCall.call_type === 'video' ? (
              <Video className="h-4 w-4" />
            ) : (
              <Phone className="h-4 w-4" />
            )}
            Incoming {incomingCall.call_type} call...
          </p>

          {/* Action Buttons */}
          <div className="flex justify-center gap-6">
            <Button
              onClick={handleDecline}
              variant="destructive"
              size="lg"
              className="rounded-full w-16 h-16"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
            <Button
              onClick={handleAccept}
              size="lg"
              className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600"
            >
              {incomingCall.call_type === 'video' ? (
                <Video className="h-6 w-6" />
              ) : (
                <Phone className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
