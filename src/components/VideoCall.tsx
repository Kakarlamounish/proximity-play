import React, { useEffect, useRef, useState, useCallback } from 'react';
import SimplePeer from 'simple-peer';
import { RealtimeChannel } from '@supabase/supabase-js';
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
  const channelRef = useRef<RealtimeChannel | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const sendSignal = useCallback(async (signal: SimplePeer.SignalData) => {
    try {
      await supabase
        .from('messages')
        .insert({
          bubble_id: bubbleId,
          sender_id: user?.id,
          content: JSON.stringify({ type: 'webrtc_signal', signal })
        });
    } catch (error) {
      console.error('Error sending signal:', error);
    }
  }, [bubbleId, user?.id]);

  const listenForSignals = useCallback((peerInstance: SimplePeer.Instance) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel(`call-${bubbleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `bubble_id=eq.${bubbleId}`,
        },
        (payload) => {
          try {
            const message = payload.new;
            if (message.sender_id !== user?.id && message.content) {
              const parsed = JSON.parse(message.content);
              if (parsed.type === 'webrtc_signal' && parsed.signal) {
                peerInstance.signal(parsed.signal);
              }
            }
          } catch (error) {
            console.error('Error processing signal:', error);
          }
        }
      )
      .subscribe();
  }, [bubbleId, user?.id]);

  const initializeCall = useCallback(async () => {
    try {
      const constraints = {
        video: callType === 'video',
        audio: true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setLocalStream(stream);
      
      if (callType === 'video' && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const newPeer = new SimplePeer({
        initiator: isInitiator,
        trickle: false,
        stream: stream
      });

      newPeer.on('signal', (data: SimplePeer.SignalData) => {
        sendSignal(data);
      });

      newPeer.on('connect', () => {
        setCallStatus('connected');
        toast({
          title: 'Call Connected',
          description: 'You are now connected to the call.',
        });
      });

      newPeer.on('stream', (remoteStream) => {
        setRemoteStream(remoteStream);
        if (callType === 'video' && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });

      newPeer.on('error', (err) => {
        console.error('Peer error:', err);
        toast({
          title: 'Call Error',
          description: 'There was an error with the call connection.',
          variant: 'destructive',
        });
      });

      newPeer.on('close', () => {
        setCallStatus('ended');
        onCallEnd?.();
      });

      setPeer(newPeer);
      listenForSignals(newPeer);

    } catch (error) {
      console.error('Error initializing call:', error);
      toast({
        title: 'Call Error',
        description: 'Could not access camera/microphone.',
        variant: 'destructive',
      });
    }
  }, [callType, isInitiator, user?.id, bubbleId, onCallEnd, toast, sendSignal, listenForSignals]);

  const endCall = useCallback(() => {
    if (peer) {
      peer.destroy();
      setPeer(null);
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    setCallStatus('ended');
    onCallEnd?.();
  }, [peer, localStream, onCallEnd]);

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
