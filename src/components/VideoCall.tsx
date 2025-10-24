import React, { useEffect, useRef, useState, useCallback } from 'react';
import SimplePeer from 'simple-peer';
// removed potentially incompatible RealtimeChannel import
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Phone, 
  PhoneOff, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface VideoCallProps {
  bubbleId: string;
  callType?: 'audio' | 'video';
  isInitiator?: boolean;
  onCallEnd?: () => void;
}

export const VideoCall: React.FC<VideoCallProps> = ({
  bubbleId,
  callType = 'video',
  isInitiator = false,
  onCallEnd
}) => {
  const [peer, setPeer] = useState<SimplePeer.Instance | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  // use a loose type here to avoid runtime issues if supabase types differ
  const channelRef = useRef<any | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const sendSignal = useCallback(async (signal: SimplePeer.SignalData) => {
    console.log('VideoCall: Sending WebRTC signal:', signal);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          bubble_id: bubbleId,
          sender_id: user?.id,
          content: JSON.stringify({ type: 'webrtc_signal', signal, timestamp: Date.now() })
        });
      if (error) {
        console.error('VideoCall: Error sending signal:', error);
        throw error;
      }
      console.log('VideoCall: Signal sent successfully');
    } catch (error) {
      console.error('VideoCall: Error sending signal:', error);
    }
  }, [bubbleId, user?.id]);

  const listenForSignals = useCallback((peerInstance: SimplePeer.Instance) => {
    console.log('VideoCall: Setting up signal listener for bubble:', bubbleId);
    // cleanup existing channel
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
      } catch (e) {
        console.warn('VideoCall: Failed to remove existing channel', e);
      }
      channelRef.current = null;
    }

    // create channel, attach listener, then subscribe and keep the channel ref
    try {
      const channel = supabase.channel(`call-${bubbleId}-${Date.now()}`);
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `bubble_id=eq.${bubbleId}`,
        },
        (payload: any) => {
          try {
            console.log('VideoCall: Received message payload:', payload?.new);
            const message = payload?.new;
            if (!message) return;
            if (message.sender_id === user?.id) return; // ignore own messages
            if (!message.content) return;
            const parsed = JSON.parse(message.content);
            console.log('VideoCall: Parsed message content:', parsed);
            if (parsed.type === 'webrtc_signal' && parsed.signal) {
              // small delay to ensure peer is ready
              setTimeout(() => {
                try {
                  peerInstance.signal(parsed.signal);
                  console.log('VideoCall: Signal applied successfully');
                } catch (signalError) {
                  console.error('VideoCall: Error applying signal:', signalError);
                }
              }, 100);
            }
          } catch (error) {
            console.error('VideoCall: Error processing incoming message:', error);
          }
        }
      );
      // subscribe and store the channel reference for later removal
      // subscribe may be sync or async depending on supabase version
      const sub = channel.subscribe();
      channelRef.current = channel;
      console.log('VideoCall: Signal listener subscribed', sub);
    } catch (err) {
      console.error('VideoCall: Failed to setup realtime channel', err);
    }
  }, [bubbleId, user?.id]);

  const initializeCall = useCallback(async () => {
    console.log('VideoCall: Initializing call', { callType, isInitiator, bubbleId });
    try {
      const constraints = {
        video: callType === 'video',
        audio: true
      };
      console.log('VideoCall: Requesting media with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('VideoCall: Got local stream:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));

      setLocalStream(stream);

      if (callType === 'video' && localVideoRef.current) {
        try {
          localVideoRef.current.srcObject = stream;
          // some browsers require play() call
          localVideoRef.current.play().catch(() => {});
        } catch (e) {
          console.warn('VideoCall: local video assignment failed', e);
        }
      }

      const newPeer = new SimplePeer({
        initiator: isInitiator,
        trickle: false,
        stream: stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });
      console.log('VideoCall: Created SimplePeer instance, initiator:', isInitiator);

      newPeer.on('signal', (data: SimplePeer.SignalData) => {
        console.log('VideoCall: Peer generated signal (raw):', data);
        // avoid assuming data.type exists
        sendSignal(data);
      });

      newPeer.on('connect', () => {
        console.log('VideoCall: Peer connected successfully');
        setCallStatus('connected');
        toast({
          title: 'Call Connected',
          description: 'You are now connected to the call.',
        });
      });

      newPeer.on('stream', (incomingRemoteStream: MediaStream) => {
        console.log('VideoCall: Received remote stream:', incomingRemoteStream?.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));
        setRemoteStream(incomingRemoteStream);
        if (callType === 'video' && remoteVideoRef.current) {
          try {
            remoteVideoRef.current.srcObject = incomingRemoteStream;
            remoteVideoRef.current.play().catch(() => {});
          } catch (e) {
            console.warn('VideoCall: remote video assignment failed', e);
          }
        }
      });

      newPeer.on('error', (err) => {
        console.error('VideoCall: Peer error:', err);
        toast({
          title: 'Call Error',
          description: 'There was an error with the call connection.',
          variant: 'destructive',
        });
      });

      newPeer.on('close', () => {
        console.log('VideoCall: Peer connection closed');
        setCallStatus('ended');
        onCallEnd?.();
      });

      setPeer(newPeer);
      listenForSignals(newPeer);

    } catch (error) {
      console.error('VideoCall: Error initializing call:', error);
      toast({
        title: 'Call Error',
        description: 'Could not access camera/microphone.',
        variant: 'destructive',
      });
      // mark call as ended to avoid stuck UI
      setCallStatus('ended');
    }
  }, [callType, isInitiator, user?.id, bubbleId, onCallEnd, toast, sendSignal, listenForSignals]);

  const endCall = useCallback(() => {
    console.log('VideoCall: Ending call');
    if (peer) {
      try {
        peer.destroy();
        console.log('VideoCall: Peer destroyed');
      } catch (error) {
        console.error('VideoCall: Error destroying peer:', error);
      }
      setPeer(null);
    }

    if (localStream) {
      localStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (error) {
          console.error('VideoCall: Error stopping track:', error);
        }
      });
      setLocalStream(null);
    }

    if (remoteStream) {
      // don't try to stop remote tracks (they belong to other peer) — just clear
      setRemoteStream(null);
    }

    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
        console.log('VideoCall: Channel removed');
      } catch (error) {
        console.error('VideoCall: Error removing channel:', error);
      }
      channelRef.current = null;
    }

    setCallStatus('ended');
    onCallEnd?.();
  }, [peer, localStream, remoteStream, onCallEnd]);

  useEffect(() => {
    initializeCall();
    
    return () => {
      endCall();
    };
  }, [initializeCall, endCall]);

  const toggleVideo = useCallback(() => {
    if (callType !== 'video') return;
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  }, [callType, localStream, isVideoEnabled]);

  const toggleAudio = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isAudioEnabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  }, [localStream, isAudioEnabled]);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerEnabled(!isSpeakerEnabled);
  }, [isSpeakerEnabled]);

  return (
    <Card className="w-full max-w-4xl mx-auto bg-black/90 text-white border-0">
      <CardContent className="p-0 relative h-[600px] flex">
        {/* Remote Video/Audio */}
        <div className="flex-1 relative">
          {callType === 'video' ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded">
              <div className="text-center">
                <Phone className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg">Audio Call Active</p>
                {remoteStream && (
                  <p className="text-sm text-green-400">Remote audio connected</p>
                )}
              </div>
            </div>
          )}
          
          {callStatus === 'connecting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p>Connecting to {callType} call...</p>
              </div>
            </div>
          )}
        </div>

        {/* Local Video/Audio Indicator */}
        {callType === 'video' ? (
          <div className="absolute top-4 right-4 w-48 h-36 bg-black rounded-lg overflow-hidden border-2 border-white/20">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="absolute top-4 right-4 w-48 h-36 bg-gray-900 rounded-lg border-2 border-white/20 flex items-center justify-center">
            <div className="text-center">
              <Mic className={isAudioEnabled ? "h-8 w-8 text-green-400" : "h-8 w-8 text-red-400"} />
              <p className="text-xs mt-1">{isAudioEnabled ? "Mic On" : "Mic Off"}</p>
            </div>
          </div>
        )}

        {/* Call Controls */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-black/80 backdrop-blur-sm rounded-full px-6 py-3">
          <Button
            onClick={toggleAudio}
            size="sm"
            variant={isAudioEnabled ? "secondary" : "destructive"}
            className="rounded-full w-12 h-12"
          >
            {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>

          {callType === 'video' && (
            <Button
              onClick={toggleVideo}
              size="sm"
              variant={isVideoEnabled ? "secondary" : "destructive"}
              className="rounded-full w-12 h-12"
            >
              {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
          )}

          <Button
            onClick={toggleSpeaker}
            size="sm"
            variant={isSpeakerEnabled ? "secondary" : "outline"}
            className="rounded-full w-12 h-12"
          >
            {isSpeakerEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>

          <Button
            onClick={endCall}
            size="sm"
            variant="destructive"
            className="rounded-full w-14 h-14"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>

        {/* Call Status */}
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              callStatus === 'connected' ? 'bg-green-500' : 
              callStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
            }`} />
            <span className="text-sm capitalize">{callStatus} {callType} call</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
