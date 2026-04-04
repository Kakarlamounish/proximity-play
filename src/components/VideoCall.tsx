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
  RotateCcw,
  Monitor,
  MonitorOff,
  Wifi,
  ChevronDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { useRingtone } from '@/hooks/useRingtone';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CallQualityBadge, deriveQualityLevel, type CallQualityLevel } from '@/components/CallQualityBadge';
import { BubbleCallRoster } from '@/components/BubbleCallRoster';

interface VideoCallProps {
  bubbleId: string;
  callType?: 'audio' | 'video';
  isInitiator?: boolean;
  callLogId?: string;
  identity?:
    | { kind: 'direct'; title: string; avatarUrl?: string }
    | { kind: 'bubble'; title: string };
  onCallEnd?: () => void;
}

export const VideoCall: React.FC<VideoCallProps> = ({
  bubbleId,
  callType = 'video',
  isInitiator = false,
  callLogId,
  identity,
  onCallEnd
}) => {
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended' | 'failed'>('connecting');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [iceState, setIceState] = useState<RTCIceConnectionState>('new');
  const [statsOpen, setStatsOpen] = useState(false);
  const [quality, setQuality] = useState<{ rttMs?: number; packetsLost?: number; jitterMs?: number; bitrateKbps?: number }>({});
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  // FIX #5: ref mirrors of state so mount-cleanup closures see live values
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { startRinging, stopRinging, playOnce } = useRingtone();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sendSignal = useCallback(async (signal: unknown, signalType: string) => {
    console.log('VideoCall: Sending signal:', signalType);
    if (!channelRef.current) return;
    try {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'webrtc_signal',
        payload: {
          sender_id: user?.id,
          signalType,
          signal,
          timestamp: Date.now(),
          callType
        }
      });
    } catch (error) {
      console.error('VideoCall: Error sending signal:', error);
    }
  }, [user?.id, callType]);

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
      setIceState(pc.iceConnectionState);
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
      setConnectionState(pc.connectionState);
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

  const handleSignal = useCallback(async (pc: RTCPeerConnection, signalType: string, signal: unknown) => {
    console.log('VideoCall: Handling signal:', signalType);
    
    try {
      if (signalType === 'ready' && isInitiator) {
        if (pc.signalingState !== 'stable') return;
        console.log('VideoCall: Receiver is ready, creating offer');
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === 'video'
        });
        await pc.setLocalDescription(offer);
        sendSignal(offer, 'offer');
      } else if (signalType === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(answer, 'answer');
        
        while (pendingCandidatesRef.current.length > 0) {
          const candidate = pendingCandidatesRef.current.shift();
          if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } else if (signalType === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal as RTCSessionDescriptionInit));
        
        while (pendingCandidatesRef.current.length > 0) {
          const candidate = pendingCandidatesRef.current.shift();
          if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } else if (signalType === 'ice-candidate') {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(signal as RTCIceCandidateInit));
        } else {
          pendingCandidatesRef.current.push(signal as RTCIceCandidateInit);
        }
      }
    } catch (error) {
      console.error('VideoCall: Error handling signal:', error);
    }
  }, [sendSignal, isInitiator, callType]);

  // Ref for endCall so broadcast listener can call it without stale closures
  const endCallRef = useRef<() => void>(() => {});

  const listenForSignals = useCallback((pc: RTCPeerConnection) => {
    return new Promise<void>((resolve) => {
      console.log('VideoCall: Setting up signal listener');
      
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (e) {
          console.debug('VideoCall: cleanup exception', e);
        }
        channelRef.current = null;
      }

      const roomExt = callLogId || bubbleId;
      const channel = supabase.channel(`call-broadcast-${roomExt}`);
      
      channel.on(
        'broadcast',
        { event: 'webrtc_signal' },
        (payload: { payload?: { sender_id?: string; signalType?: string; signal?: unknown } }) => {
          try {
            const message = payload.payload;
            if (!message || message.sender_id === user?.id) return;

            // If the remote side sent a "call-ended" signal, end locally
            if (message.signalType === 'call-ended') {
              console.log('VideoCall: Remote party ended call');
              endCallRef.current();
              return;
            }

            handleSignal(pc, message.signalType, message.signal);
          } catch (error) {
            console.error('VideoCall: Error processing message:', error);
          }
        }
      );
      
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('VideoCall: Channel subscribed');
          if (!isInitiator) {
            const sendReady = () => {
              if (pc.signalingState === 'stable') {
                channel.send({
                  type: 'broadcast',
                  event: 'webrtc_signal',
                  payload: { sender_id: user?.id, signalType: 'ready', signal: {} }
                });
              } else if (readyIntervalRef.current) {
                clearInterval(readyIntervalRef.current);
                readyIntervalRef.current = null;
              }
            };
            sendReady();
            readyIntervalRef.current = setInterval(sendReady, 2000);
          }
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          resolve();
        }
      });
      
      channelRef.current = channel;
    });
  }, [bubbleId, callLogId, user?.id, handleSignal, isInitiator]);

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
      } catch (constraintError: unknown) {
        const err = constraintError as Error;
        console.warn('VideoCall: Failed with ideal constraints, trying minimal:', err.message);
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
      localStreamRef.current = stream; // FIX #5: keep ref in sync with state

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
      peerConnectionRef.current = pc; // FIX #5: keep ref in sync with state

      // Set up signaling and wait for subscription
      await listenForSignals(pc);

      // Only the receiver sends a ready signal to prompt the initiator
      if (isInitiator) {
        console.log('VideoCall: Waiting for receiver ready loop');
      }

      toast({
        title: 'Connecting',
        description: 'Waiting for the other party to join...',
      });

    } catch (error: unknown) {
      const err = error as Error;
      console.error('VideoCall: Init error:', err);
      setCallStatus('failed');
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      let errorMessage = 'Could not start call.';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Permission denied. Please allow camera/microphone access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera or microphone found. Please connect a device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Camera or microphone is in use by another application.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      toast({
        title: 'Call Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [callType, isInitiator, createPeerConnection, listenForSignals, toast]);

  // Best-effort call log bookkeeping for duration.
  useEffect(() => {
    if (!callLogId || callStatus !== 'ended') return;
    if (callDuration <= 0) return;
    supabase
      .from('call_logs')
      .update({ duration_seconds: callDuration, ended_at: new Date().toISOString() })
      .eq('id', callLogId)
      .then(() => {})
      .catch(() => {});
  }, [callLogId, callDuration, callStatus]);

  // Collect lightweight call quality metrics when connected.
  const prevQualityRef = useRef<CallQualityLevel>('good');

  useEffect(() => {
    if (!peerConnection) return;
    if (callStatus !== 'connected') return;

    let lastBytesSent: number | null = null;
    let lastTs: number | null = null;

    const id = window.setInterval(async () => {
      try {
        const reports = await peerConnection.getStats();

        let rttMs: number | undefined;
        let packetsLost: number | undefined;
        let jitterMs: number | undefined;
        let bitrateKbps: number | undefined;

        reports.forEach((r: Record<string, unknown>) => {
          if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.currentRoundTripTime != null) {
            rttMs = Math.round(Number(r.currentRoundTripTime) * 1000);
          }
          if (r.type === 'inbound-rtp' && r.kind === 'audio') {
            if (r.packetsLost != null) packetsLost = Number(r.packetsLost);
            if (r.jitter != null) jitterMs = Math.round(Number(r.jitter) * 1000);
          }
          if (r.type === 'outbound-rtp' && (r.kind === 'video' || r.kind === 'audio')) {
            if (r.bytesSent != null && r.timestamp != null) {
              const bytes = Number(r.bytesSent);
              const ts = Number(r.timestamp);
              if (lastBytesSent != null && lastTs != null) {
                const deltaBytes = bytes - lastBytesSent;
                const deltaSec = (ts - lastTs) / 1000;
                if (deltaSec > 0) {
                  bitrateKbps = Math.round((deltaBytes * 8) / 1000 / deltaSec);
                }
              }
              lastBytesSent = bytes;
              lastTs = ts;
            }
          }
        });

        // FIX #4: use functional updater so we never close over stale `quality`
        setQuality(prev => ({
          ...prev,
          ...(rttMs != null && { rttMs }),
          ...(packetsLost != null && { packetsLost }),
          ...(jitterMs != null && { jitterMs }),
          ...(bitrateKbps != null && { bitrateKbps }),
        }));

        // Warn on quality degradation — derive from local vars (newQ removed by fix #4)
        const level = deriveQualityLevel({ rttMs, packetsLost, jitterMs });
        if (level === 'poor' && prevQualityRef.current !== 'poor') {
          toast({ title: 'Poor call quality', description: 'High latency or packet loss detected.', variant: 'destructive' });
        } else if (level === 'fair' && prevQualityRef.current === 'good') {
          toast({ title: 'Call quality degraded', description: 'Connection quality is fair.' });
        }
        prevQualityRef.current = level;
      } catch (e) {
        // ignore
      }
    }, 2000);

    return () => window.clearInterval(id);
  }, [peerConnection, callStatus, toast]);

  const endCall = useCallback(() => {
    console.log('VideoCall: Ending call');
    
    stopRinging();
    playOnce('hangup');
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (readyIntervalRef.current) {
      clearInterval(readyIntervalRef.current);
      readyIntervalRef.current = null;
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
  }, [peerConnection, localStream, onCallEnd, stopRinging, playOnce]);

  // Start outgoing ringing sound when initiator is connecting
  useEffect(() => {
    if (isInitiator && callStatus === 'connecting') {
      startRinging('outgoing');
    } else {
      stopRinging();
    }

    return () => {
      stopRinging();
    };
  }, [isInitiator, callStatus, startRinging, stopRinging]);

  useEffect(() => {
    initializeCall();
    
    return () => {
      stopRinging();
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (readyIntervalRef.current) {
        clearInterval(readyIntervalRef.current);
      }
      // FIX #5: use refs instead of stale state values in the cleanup closure
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (channelRef.current) {
        try { supabase.removeChannel(channelRef.current); } catch { console.debug('Cleanup error handle'); }
      }
    };
  }, [initializeCall, stopRinging]);

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
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
    }
    initializeCall();
  };

  const toggleScreenShare = useCallback(async () => {
    if (!peerConnection || callType !== 'video') return;

    if (isScreenSharing) {
      // Stop screen sharing and switch back to camera
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
      }

      // Replace screen track with camera track
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
          }
        }
      }

      setIsScreenSharing(false);
      toast({
        title: 'Screen Share Stopped',
        description: 'Switched back to camera',
      });
    } else {
      // Start screen sharing
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor'
          } as MediaTrackConstraints,
          audio: false
        });

        setScreenStream(displayStream);

        // Replace camera track with screen track
        const screenTrack = displayStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender && screenTrack) {
          await sender.replaceTrack(screenTrack);
        }

        // Show screen in local preview
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = displayStream;
        }

        // Handle when user stops sharing via browser controls
        screenTrack.onended = () => {
          if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack && sender) {
              sender.replaceTrack(videoTrack);
            }
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = localStream;
            }
          }
          setScreenStream(null);
          setIsScreenSharing(false);
          toast({
            title: 'Screen Share Ended',
            description: 'Switched back to camera',
          });
        };

        setIsScreenSharing(true);
        toast({
          title: 'Screen Sharing',
          description: 'Your screen is now being shared',
        });
      } catch (error: unknown) {
        const err = error as Error;
        console.error('Screen share error:', err);
        if (err.name !== 'NotAllowedError') {
          toast({
            title: 'Screen Share Failed',
            description: err.message || 'Could not share screen',
            variant: 'destructive',
          });
        }
      }
    }
  }, [peerConnection, callType, isScreenSharing, screenStream, localStream, toast]);

  return (
    <Card className="w-full max-w-4xl mx-auto bg-black/95 text-white border-0 overflow-hidden">
      <CardContent className="p-0 relative h-[600px] flex flex-col">
        <audio ref={remoteAudioRef} autoPlay className="hidden" />

        {/* In-call status bar */}
        <div className="absolute top-0 left-0 right-0 z-20">
          <div className="mx-auto max-w-4xl">
            <div className="m-3 rounded-xl border border-border/40 bg-card/40 backdrop-blur px-3 py-2 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {identity?.kind === 'direct' ? (
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={identity.avatarUrl} />
                      <AvatarFallback>{identity.title?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="h-7 w-7 rounded-full border border-border/40 bg-background/40" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">
                      {identity?.kind === 'bubble' ? 'Bubble call' : 'Direct call'}
                    </p>
                    <p className="text-sm font-medium text-foreground truncate">
                      {identity?.title || 'Call'}
                    </p>
                  </div>

                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      callStatus === 'connected'
                        ? 'bg-primary'
                        : callStatus === 'connecting'
                          ? 'bg-primary/70 animate-pulse'
                          : 'bg-muted-foreground/60'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-foreground truncate">
                    {callStatus === 'connecting'
                      ? 'Ringing'
                      : callStatus === 'connected'
                        ? 'Connected'
                        : 'Ended'}
                  </span>
                  {/* Answer button for incoming calls */}
                  {!isInitiator && callStatus === 'connecting' && !hasAnswered && (
                    <Button size="sm" variant="secondary" onClick={() => {
                      setHasAnswered(true);
                      if (readyIntervalRef.current) {
                        clearInterval(readyIntervalRef.current);
                        readyIntervalRef.current = null;
                      }
                    }}>
                      Answer
                    </Button>
                  )}
                  {callStatus === 'connected' && (
                    <span className="text-sm font-mono text-muted-foreground">
                      {formatDuration(callDuration)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Quality badge */}
                  {callStatus === 'connected' && (
                    <CallQualityBadge level={deriveQualityLevel(quality)} />
                  )}
                  {/* Quality details */}
                  <button
                    type="button"
                    onClick={() => setStatsOpen(v => !v)}
                    className="inline-flex items-center gap-1 rounded-md border border-border/40 px-2 py-1 text-xs text-foreground"
                    title="Call quality"
                  >
                    <Wifi className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {connectionState}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${statsOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <div
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs border ${
                      isAudioEnabled
                        ? 'border-border/40 text-foreground'
                        : 'border-destructive/40 text-destructive'
                    }`}
                    title={isAudioEnabled ? 'Microphone on' : 'Microphone muted'}
                  >
                    {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    <span className="hidden sm:inline">Audio</span>
                  </div>

                  {callType === 'video' && (
                    <div
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs border ${
                        isVideoEnabled || isScreenSharing
                          ? 'border-border/40 text-foreground'
                          : 'border-destructive/40 text-destructive'
                      }`}
                      title={
                        isScreenSharing
                          ? 'Screen sharing'
                          : isVideoEnabled
                            ? 'Camera on'
                            : 'Camera off'
                      }
                    >
                      {isVideoEnabled || isScreenSharing ? (
                        <Video className="h-4 w-4" />
                      ) : (
                        <VideoOff className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">Video</span>
                    </div>
                  )}
                </div>
              </div>

              {statsOpen && (
                <div className="mt-2 rounded-lg border border-border/40 bg-background/40 p-2 text-xs text-foreground">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-muted-foreground">Connection</div>
                      <div className="font-mono">{connectionState}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">ICE</div>
                      <div className="font-mono">{iceState}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">RTT</div>
                      <div className="font-mono">{quality.rttMs != null ? `${quality.rttMs}ms` : '—'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Bitrate</div>
                      <div className="font-mono">{quality.bitrateKbps != null ? `${quality.bitrateKbps}kbps` : '—'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Jitter</div>
                      <div className="font-mono">{quality.jitterMs != null ? `${quality.jitterMs}ms` : '—'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Packets lost</div>
                      <div className="font-mono">{quality.packetsLost != null ? quality.packetsLost : '—'}</div>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Debug stats update every ~2s while connected.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Bubble call roster */}
        {identity?.kind === 'bubble' && <BubbleCallRoster bubbleId={bubbleId} />}

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
            {!isVideoEnabled && !isScreenSharing && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <VideoOff className="h-8 w-8 text-gray-400" />
              </div>
            )}
            {isScreenSharing && (
              <div className="absolute bottom-1 left-1 bg-primary/80 text-xs px-1.5 py-0.5 rounded">
                Screen
              </div>
            )}
          </div>
        ) : (
          <div className="absolute top-4 right-4 w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center border-2 border-white/20">
            <Mic className={`h-8 w-8 ${isAudioEnabled ? 'text-green-400' : 'text-red-400'}`} />
          </div>
        )}

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
            <>
              <Button
                onClick={toggleVideo}
                variant={isVideoEnabled ? 'outline' : 'destructive'}
                size="icon"
                className="h-12 w-12 rounded-full"
                disabled={isScreenSharing}
              >
                {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>

              <Button
                onClick={toggleScreenShare}
                variant={isScreenSharing ? 'default' : 'outline'}
                size="icon"
                className="h-12 w-12 rounded-full"
                disabled={callStatus !== 'connected'}
                title={isScreenSharing ? 'Stop screen share' : 'Share screen'}
              >
                {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
              </Button>
            </>
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
