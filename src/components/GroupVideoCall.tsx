import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, VolumeX, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BubbleCallRoster } from '@/components/BubbleCallRoster';

interface GroupVideoCallProps {
  bubbleId: string;
  callType?: 'audio' | 'video';
  callLogId?: string;
  title?: string;
  onCallEnd?: () => void;
}

interface RemotePeer {
  stream: MediaStream;
  name: string;
  avatarUrl?: string;
}

type SignalPayload = {
  sender_id: string;
  target_id: string;
  signalType: 'offer' | 'answer' | 'ice-candidate';
  signal: unknown;
};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

// Group calls use a mesh topology: every participant opens one RTCPeerConnection
// directly to every other participant (N participants -> N*(N-1)/2 connections).
// This is the simplest topology that needs no media server, and is the right
// tradeoff for small bubble calls; it does not scale gracefully much past
// half a dozen participants (that would need an SFU).
export const GroupVideoCall: React.FC<GroupVideoCallProps> = ({
  bubbleId,
  callType = 'video',
  callLogId,
  title,
  onCallEnd,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<Map<string, RemotePeer>>(new Map());
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const namesRef = useRef<Map<string, { name: string; avatarUrl?: string }>>(new Map());
  const endedRef = useRef(false);

  const sendSignal = useCallback((targetId: string, signalType: SignalPayload['signalType'], signal: unknown) => {
    if (!channelRef.current || !user) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'webrtc_signal',
      payload: { sender_id: user.id, target_id: targetId, signalType, signal } as SignalPayload,
    });
  }, [user]);

  const attachRemoteTrack = useCallback((peerId: string, stream: MediaStream) => {
    const known = namesRef.current.get(peerId);
    setRemotePeers(prev => {
      const next = new Map(prev);
      next.set(peerId, { stream, name: known?.name || 'Guest', avatarUrl: known?.avatarUrl });
      return next;
    });
  }, []);

  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    localStreamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) sendSignal(peerId, 'ice-candidate', event.candidate.toJSON());
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) attachRemoteTrack(peerId, stream);
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setStatus('connected');
      }
    };

    peersRef.current.set(peerId, pc);
    return pc;
  }, [sendSignal, attachRemoteTrack]);

  const removePeer = useCallback((peerId: string) => {
    const pc = peersRef.current.get(peerId);
    if (pc) {
      pc.close();
      peersRef.current.delete(peerId);
    }
    pendingCandidatesRef.current.delete(peerId);
    setRemotePeers(prev => {
      if (!prev.has(peerId)) return prev;
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  const handleOffer = useCallback(async (senderId: string, offer: RTCSessionDescriptionInit) => {
    const pc = peersRef.current.get(senderId) ?? createPeerConnection(senderId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendSignal(senderId, 'answer', answer);

    const pending = pendingCandidatesRef.current.get(senderId) ?? [];
    for (const candidate of pending) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    pendingCandidatesRef.current.delete(senderId);
  }, [createPeerConnection, sendSignal]);

  const handleAnswer = useCallback(async (senderId: string, answer: RTCSessionDescriptionInit) => {
    const pc = peersRef.current.get(senderId);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    const pending = pendingCandidatesRef.current.get(senderId) ?? [];
    for (const candidate of pending) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    pendingCandidatesRef.current.delete(senderId);
  }, []);

  const handleIceCandidate = useCallback(async (senderId: string, candidate: RTCIceCandidateInit) => {
    const pc = peersRef.current.get(senderId);
    if (pc?.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      const list = pendingCandidatesRef.current.get(senderId) ?? [];
      list.push(candidate);
      pendingCandidatesRef.current.set(senderId, list);
    }
  }, []);

  const connectToPeer = useCallback(async (peerId: string) => {
    const pc = createPeerConnection(peerId);
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: callType === 'video',
    });
    await pc.setLocalDescription(offer);
    sendSignal(peerId, 'offer', offer);
  }, [createPeerConnection, sendSignal, callType]);

  // Init: get local media, join the room, negotiate with anyone already there.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: callType === 'video' ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        if (localVideoRef.current && callType === 'video') {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error('GroupVideoCall: getUserMedia failed', err);
        toast({
          title: 'Call error',
          description: 'Could not access camera/microphone. Please check permissions.',
          variant: 'destructive',
        });
        return;
      }

      if (!user) return;
      const roomId = callLogId || bubbleId;
      const channel = supabase.channel(`group-call-${roomId}`, {
        config: { presence: { key: user.id } },
      });

      channel.on('broadcast', { event: 'webrtc_signal' }, (msg: { payload?: SignalPayload }) => {
        const payload = msg.payload;
        if (!payload || payload.target_id !== user.id || payload.sender_id === user.id) return;
        if (payload.signalType === 'offer') {
          handleOffer(payload.sender_id, payload.signal as RTCSessionDescriptionInit);
        } else if (payload.signalType === 'answer') {
          handleAnswer(payload.sender_id, payload.signal as RTCSessionDescriptionInit);
        } else if (payload.signalType === 'ice-candidate') {
          handleIceCandidate(payload.sender_id, payload.signal as RTCIceCandidateInit);
        }
      });

      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, Array<{ name: string; avatarUrl?: string }>>;
        const seenIds = new Set(Object.keys(state));

        for (const [peerId, presences] of Object.entries(state)) {
          if (peerId === user.id) continue;
          const meta = presences[0];
          if (meta) namesRef.current.set(peerId, { name: meta.name, avatarUrl: meta.avatarUrl });

          if (!peersRef.current.has(peerId)) {
            // Deterministic tie-break so exactly one side of each pair sends the offer.
            if (user.id > peerId) {
              connectToPeer(peerId);
            }
            // else: wait for their offer — they'll initiate towards us.
          }
        }

        for (const peerId of Array.from(peersRef.current.keys())) {
          if (!seenIds.has(peerId)) removePeer(peerId);
        }
      });

      channel.subscribe(async (subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          await channel.track({
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'You',
            avatarUrl: user.user_metadata?.avatar_url,
          });
        }
      });

      channelRef.current = channel;
    };

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endCall = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    setStatus('ended');

    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();

    localStreamRef.current?.getTracks().forEach(track => track.stop());

    if (channelRef.current) {
      channelRef.current.untrack();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (callLogId) {
      supabase.from('call_logs').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callLogId).then(() => {}).catch(() => {});
    }

    onCallEnd?.();
  }, [callLogId, onCallEnd]);

  useEffect(() => () => endCall(), [endCall]);

  const toggleAudio = () => {
    const next = !isAudioEnabled;
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = next; });
    setIsAudioEnabled(next);
  };

  const toggleVideo = () => {
    const next = !isVideoEnabled;
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = next; });
    setIsVideoEnabled(next);
  };

  const remoteList = Array.from(remotePeers.entries());
  const gridCols = remoteList.length <= 1 ? 'grid-cols-1' : remoteList.length <= 4 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <Card className="w-full h-full bg-gray-900 border-0 overflow-hidden">
      <CardContent className="p-0 h-full relative flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-black/60 text-white">
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${status === 'connected' ? 'bg-primary' : 'bg-primary/70 animate-pulse'}`} />
            <span className="text-sm font-medium truncate">{title || 'Bubble call'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/70">
            <Users className="h-3.5 w-3.5" />
            {remoteList.length + 1}
          </div>
        </div>

        <BubbleCallRoster bubbleId={bubbleId} />

        <div className="flex-1 relative bg-gray-950">
          {callType === 'video' ? (
            remoteList.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-white/60 text-sm">
                Waiting for others to join…
              </div>
            ) : (
              <div className={`grid ${gridCols} gap-1 w-full h-full p-1`}>
                {remoteList.map(([peerId, peer]) => (
                  <RemoteVideoTile key={peerId} peer={peer} />
                ))}
              </div>
            )
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-white">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Phone className="h-14 w-14 text-white" />
              </div>
              <div className="flex -space-x-2">
                {remoteList.map(([peerId, peer]) => (
                  <Avatar key={peerId} className="h-10 w-10 border-2 border-gray-950">
                    <AvatarImage src={peer.avatarUrl} />
                    <AvatarFallback>{peer.name[0]?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              {remoteList.map(([peerId, peer]) => (
                <audio key={peerId} autoPlay ref={(el) => { if (el) el.srcObject = peer.stream; }} />
              ))}
            </div>
          )}
        </div>

        {callType === 'video' && (
          <div className="absolute top-16 right-4 w-28 h-20 sm:w-40 sm:h-28 bg-gray-900 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {!isVideoEnabled && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <VideoOff className="h-6 w-6 text-gray-400" />
              </div>
            )}
          </div>
        )}

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 sm:gap-4 bg-black/80 backdrop-blur-sm rounded-full px-4 sm:px-6 py-3">
          <Button onClick={toggleAudio} variant={isAudioEnabled ? 'outline' : 'destructive'} size="icon" className="h-12 w-12 rounded-full">
            {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
          {callType === 'video' && (
            <Button onClick={toggleVideo} variant={isVideoEnabled ? 'outline' : 'destructive'} size="icon" className="h-12 w-12 rounded-full">
              {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
          )}
          <Button onClick={() => setIsSpeakerEnabled(v => !v)} variant={isSpeakerEnabled ? 'outline' : 'secondary'} size="icon" className="h-12 w-12 rounded-full">
            {isSpeakerEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
          <Button onClick={endCall} variant="destructive" size="icon" className="h-14 w-14 rounded-full">
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const RemoteVideoTile: React.FC<{ peer: RemotePeer }> = ({ peer }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = peer.stream;
      ref.current.play().catch(() => {});
    }
  }, [peer.stream]);

  return (
    <div className="relative bg-gray-900 rounded-md overflow-hidden">
      <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
      <span className="absolute bottom-1 left-1 text-xs text-white bg-black/50 rounded px-1.5 py-0.5">
        {peer.name}
      </span>
    </div>
  );
};
