import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  VolumeX,
  RotateCcw
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
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended' | 'failed'>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const channelRef = useRef<any>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sendSignal = useCallback(async (signal: any, signalType: string) => {
    console.log('VideoCall: Sending signal:', signalType);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          bubble_id: bubbleId,
          sender_id: user?.id,
          content: JSON.stringify({ 
            type: 'webrtc_signal',
            signalType,
            signal, 
            timestamp: Date.now(),
            callType 
          })
        });
      if (error) {
        console.error('VideoCall: Error sending signal:', error);
      }
    } catch (error) {
      console.error('VideoCall: Error sending signal:', error);
    }
  }, [bubbleId, user?.id, callType]);

  const createPeerConnection = useCallback((stream: MediaStream): RTCPeerConnection => {
    console.log('VideoCall: Creating RTCPeerConnection');
    
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ]
    };

    const pc = new RTCPeerConnection(config);

    // Add local tracks
    stream.getTracks().forEach(track => {
      console.log('VideoCall: Adding track:', track.kind);
      pc.addTrack(track, stream);
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('VideoCall: ICE candidate:', event.candidate.type);
        sendSignal(event.candidate.toJSON(), 'ice-candidate');
      }
    };

    pc.onicecandidateerror = (event) => {
      console.error('VideoCall: ICE candidate error:', event);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('VideoCall: ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallStatus('connected');
        if (!durationIntervalRef.current) {
          durationIntervalRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
          }, 1000);
        }
      } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.warn('VideoCall: Connection failed/disconnected');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('VideoCall: Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallStatus('connected');
        toast({
          title: 'Connected',
          description: 'Call connected successfully',
        });
      } else if (pc.connectionState === 'failed') {
        setCallStatus('failed');
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('VideoCall: Received remote track:', event.track.kind);
      const [remoteMediaStream] = event.streams;
      setRemoteStream(remoteMediaStream);
      
      if (callType === 'video' && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteMediaStream;
        remoteVideoRef.current.play().catch(e => console.warn('Remote video play failed:', e));
      } else if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteMediaStream;
        remoteAudioRef.current.play().catch(e => console.warn('Remote audio play failed:', e));
      }
    };

    return pc;
  }, [callType, sendSignal, toast]);

  const handleSignal = useCallback(async (pc: RTCPeerConnection, signalType: string, signal: any) => {
    console.log('VideoCall: Handling signal:', signalType);
    
    try {
      if (signalType === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(answer, 'answer');
      } else if (signalType === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signalType === 'ice-candidate') {
        await pc.addIceCandidate(new RTCIceCandidate(signal));
      }
    } catch (error) {
      console.error('VideoCall: Error handling signal:', error);
    }
  }, [sendSignal]);

  const listenForSignals = useCallback((pc: RTCPeerConnection) => {
    console.log('VideoCall: Setting up signal listener');
    
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
      } catch (e) {
        console.warn('VideoCall: Failed to remove existing channel', e);
      }
      channelRef.current = null;
    }

    const channel = supabase.channel(`call-signals-${bubbleId}-${Date.now()}`);
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
          const message = payload?.new;
          if (!message || message.sender_id === user?.id) return;
          
          const parsed = JSON.parse(message.content);
          if (parsed.type === 'webrtc_signal' && parsed.signal) {
            handleSignal(pc, parsed.signalType, parsed.signal);
          }
        } catch (error) {
          console.error('VideoCall: Error processing message:', error);
        }
      }
    );
    channel.subscribe();
    channelRef.current = channel;
  }, [bubbleId, user?.id, handleSignal]);

  const initializeCall = useCallback(async () => {
    console.log('VideoCall: Initializing', { callType, isInitiator });
    setCallStatus('connecting');
    
    let stream: MediaStream | null = null;
    
    try {
      // Check if RTCPeerConnection is available
      if (typeof RTCPeerConnection === 'undefined') {
        throw new Error('WebRTC is not supported in this browser');
      }

      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices not supported in this browser');
      }

      // Request media stream
      console.log('VideoCall: Requesting media stream');
      try {
        const constraints: MediaStreamConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: callType === 'video' ? {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          } : false
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (constraintError: any) {
        console.warn('VideoCall: Failed with ideal constraints, trying minimal:', constraintError.message);
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: callType === 'video' 
        });
      }
      
      if (!stream) {
        throw new Error('Failed to get media stream');
      }
      
      console.log('VideoCall: Got local stream with tracks:', stream.getTracks().map(t => `${t.kind}:${t.enabled}`));
      setLocalStream(stream);

      // Display local video
      if (callType === 'video' && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        try {
          await localVideoRef.current.play();
        } catch (playErr) {
          console.warn('VideoCall: Local video autoplay failed:', playErr);
        }
      }

      // Create peer connection
      const pc = createPeerConnection(stream);
      setPeerConnection(pc);

      // Set up signaling
      listenForSignals(pc);

      // If initiator, create and send offer
      if (isInitiator) {
        console.log('VideoCall: Creating offer');
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === 'video'
        });
        await pc.setLocalDescription(offer);
        sendSignal(offer, 'offer');
      }

      toast({
        title: 'Connecting',
        description: 'Waiting for the other party to join...',
      });

    } catch (error: any) {
      console.error('VideoCall: Init error:', error);
      setCallStatus('failed');
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      let errorMessage = 'Could not start call.';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Permission denied. Please allow camera/microphone access in your browser settings.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera or microphone found. Please connect a device.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Camera or microphone is in use by another application.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Call Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [callType, isInitiator, createPeerConnection, listenForSignals, sendSignal, toast]);

  const endCall = useCallback(() => {
    console.log('VideoCall: Ending call');
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    setRemoteStream(null);

    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
      } catch (error) {
        console.error('VideoCall: Error removing channel:', error);
      }
      channelRef.current = null;
    }

    setCallStatus('ended');
    onCallEnd?.();
  }, [peerConnection, localStream, onCallEnd]);

  useEffect(() => {
    initializeCall();
    
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (peerConnection) {
        peerConnection.close();
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (channelRef.current) {
        try { supabase.removeChannel(channelRef.current); } catch {}
      }
    };
  }, []);

  const toggleVideo = useCallback(() => {
    if (callType !== 'video' || !localStream) return;
    localStream.getVideoTracks().forEach(track => {
      track.enabled = !isVideoEnabled;
    });
    setIsVideoEnabled(!isVideoEnabled);
  }, [callType, localStream, isVideoEnabled]);

  const toggleAudio = useCallback(() => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach(track => {
      track.enabled = !isAudioEnabled;
    });
    setIsAudioEnabled(!isAudioEnabled);
  }, [localStream, isAudioEnabled]);

  const toggleSpeaker = useCallback(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = isSpeakerEnabled;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = isSpeakerEnabled;
    }
    setIsSpeakerEnabled(!isSpeakerEnabled);
  }, [isSpeakerEnabled]);

  const retryConnection = () => {
    setCallStatus('connecting');
    setCallDuration(0);
    if (peerConnection) {
      peerConnection.close();
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    initializeCall();
  };

  return (
    <Card className="w-full max-w-4xl mx-auto bg-black/95 text-white border-0 overflow-hidden">
      <CardContent className="p-0 relative h-[600px] flex flex-col">
        <audio ref={remoteAudioRef} autoPlay className="hidden" />
        
        <div className="flex-1 relative">
          {callType === 'video' ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover bg-gray-900"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
              <div className="text-center">
                <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Phone className="h-16 w-16 text-white" />
                </div>
                <p className="text-xl font-medium mb-2">Audio Call</p>
                {callStatus === 'connected' && (
                  <p className="text-green-400 animate-pulse">Connected</p>
                )}
              </div>
            </div>
          )}
          
          {callStatus === 'connecting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto mb-4" />
                <p className="text-lg">Connecting...</p>
                <p className="text-sm text-muted-foreground mt-2">Waiting for other party</p>
              </div>
            </div>
          )}

          {callStatus === 'failed' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="text-center">
                <PhoneOff className="h-16 w-16 mx-auto mb-4 text-destructive" />
                <p className="text-lg mb-4">Connection Failed</p>
                <Button onClick={retryConnection} variant="outline" className="mr-2">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                <Button onClick={endCall} variant="destructive">
                  End Call
                </Button>
              </div>
            </div>
          )}
        </div>

        {callType === 'video' ? (
          <div className="absolute top-4 right-4 w-32 h-24 sm:w-48 sm:h-36 bg-gray-900 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!isVideoEnabled && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <VideoOff className="h-8 w-8 text-gray-400" />
              </div>
            )}
          </div>
        ) : (
          <div className="absolute top-4 right-4 w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center border-2 border-white/20">
            <Mic className={`h-8 w-8 ${isAudioEnabled ? 'text-green-400' : 'text-red-400'}`} />
          </div>
        )}

        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg px-4 py-2">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${
              callStatus === 'connected' ? 'bg-green-500' : 
              callStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
              callStatus === 'failed' ? 'bg-red-500' : 'bg-gray-500'
            }`} />
            <span className="text-sm capitalize">{callStatus}</span>
            {callStatus === 'connected' && (
              <span className="text-sm font-mono">{formatDuration(callDuration)}</span>
            )}
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 sm:gap-4 bg-black/80 backdrop-blur-sm rounded-full px-4 sm:px-6 py-3">
          <Button
            onClick={toggleAudio}
            variant={isAudioEnabled ? 'outline' : 'destructive'}
            size="icon"
            className="h-12 w-12 rounded-full"
          >
            {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>

          {callType === 'video' && (
            <Button
              onClick={toggleVideo}
              variant={isVideoEnabled ? 'outline' : 'destructive'}
              size="icon"
              className="h-12 w-12 rounded-full"
            >
              {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
          )}

          <Button
            onClick={toggleSpeaker}
            variant={isSpeakerEnabled ? 'outline' : 'secondary'}
            size="icon"
            className="h-12 w-12 rounded-full"
          >
            {isSpeakerEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>

          <Button
            onClick={endCall}
            variant="destructive"
            size="icon"
            className="h-14 w-14 rounded-full"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoCall;
