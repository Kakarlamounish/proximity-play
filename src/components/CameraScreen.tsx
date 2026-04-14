import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Camera, SwitchCamera, X, Send, Download, Zap, ZapOff, BookOpen, MessageCircle, Users, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CameraScreenProps {
  onCapture?: (imageDataUrl: string) => void;
  onClose?: () => void;
}

type SendTarget = 'story' | 'friend';

interface Friend {
  id: string;
  first_name: string;
  profile_photo_url: string | null;
}

export function CameraScreen({ onCapture, onClose }: CameraScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { user } = useAuth();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [showSendSheet, setShowSendSheet] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [sendToStory, setSendToStory] = useState(false);
  const [sending, setSending] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      if (stream) stream.getTracks().forEach(t => t.stop());
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: false,
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error('Camera error:', err);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, [facingMode]);

  // Fetch friends list
  useEffect(() => {
    if (!user) return;
    const fetchFriends = async () => {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_id_1, user_id_2')
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

      const friendIds = friendships?.map(f =>
        f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1
      ) || [];

      if (friendIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, profile_photo_url')
          .in('id', friendIds);
        setFriends(profiles || []);
      }
    };
    fetchFriends();
  }, [user]);

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (flashEnabled) {
      const flashEl = document.getElementById('camera-flash');
      if (flashEl) {
        flashEl.style.opacity = '1';
        setTimeout(() => { flashEl.style.opacity = '0'; }, 150);
      }
    }

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);
  };

  const handleSendClick = () => {
    setShowSendSheet(true);
  };

  const toggleFriend = (id: string) => {
    setSelectedFriends(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (!capturedImage || !user) return;
    setSending(true);

    try {
      // Send to selected friends as chat messages
      if (selectedFriends.size > 0) {
        const inserts = Array.from(selectedFriends).map(friendId => ({
          content: '📸 Sent a Snap!',
          sender_id: user.id,
          recipient_id: friendId,
          message_type: 'snap',
        }));
        await supabase.from('messages').insert(inserts);
      }

      // Post to story
      if (sendToStory) {
        // Use user's location if available, otherwise default
        let lat = 0, lng = 0;
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch { /* use defaults */ }

        await supabase.from('location_stories').insert({
          user_id: user.id,
          text_content: '📸 New Story Snap',
          latitude: lat,
          longitude: lng,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      // Call original onCapture for score tracking etc.
      if (onCapture) onCapture(capturedImage);
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
      setCapturedImage(null);
      setShowSendSheet(false);
      setSelectedFriends(new Set());
      setSendToStory(false);
    }
  };

  const handleDiscard = () => {
    setCapturedImage(null);
    setShowSendSheet(false);
    setSelectedFriends(new Set());
    setSendToStory(false);
  };

  const handleDownload = () => {
    if (!capturedImage) return;
    const a = document.createElement('a');
    a.href = capturedImage;
    a.download = `snap-${Date.now()}.jpg`;
    a.click();
  };

  const canSend = selectedFriends.size > 0 || sendToStory;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div id="camera-flash" className="absolute inset-0 bg-white z-50 pointer-events-none opacity-0 transition-opacity duration-150" />

      {capturedImage ? (
        <div className="flex-1 relative flex flex-col">
          <img src={capturedImage} alt="Captured" className="flex-1 object-contain" />

          {/* Top bar */}
          <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-10">
            <Button variant="ghost" size="icon" className="text-white bg-black/40 rounded-full" onClick={handleDiscard}>
              <X className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white bg-black/40 rounded-full" onClick={handleDownload}>
              <Download className="h-5 w-5" />
            </Button>
          </div>

          {/* Bottom send-to sheet */}
          {!showSendSheet ? (
            <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-4 px-6">
              <Button
                className="rounded-full px-6 py-3 bg-card/90 text-foreground hover:bg-card gap-2 shadow-lg"
                onClick={() => { setSendToStory(true); handleSendClick(); }}
              >
                <BookOpen className="h-5 w-5" />
                Story
              </Button>
              <Button
                className="rounded-full px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 gap-2 shadow-lg"
                onClick={handleSendClick}
              >
                <Send className="h-5 w-5" />
                Send To...
              </Button>
            </div>
          ) : (
            <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl max-h-[60vh] flex flex-col animate-in slide-in-from-bottom duration-300 shadow-2xl">
              {/* Sheet handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              <div className="px-4 pb-2 flex items-center justify-between">
                <h3 className="font-bold text-lg">Send To</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowSendSheet(false)}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>

              {/* My Story option */}
              <button
                onClick={() => setSendToStory(prev => !prev)}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${sendToStory ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${sendToStory ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm">My Story</p>
                  <p className="text-xs text-muted-foreground">Visible for 24 hours</p>
                </div>
                {sendToStory && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Send className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </button>

              {/* Friends list */}
              <div className="flex-1 overflow-y-auto border-t border-border">
                <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Friends</p>
                {friends.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">No friends yet</p>
                ) : (
                  friends.map(friend => {
                    const selected = selectedFriends.has(friend.id);
                    return (
                      <button
                        key={friend.id}
                        onClick={() => toggleFriend(friend.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${selected ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={friend.profile_photo_url || undefined} />
                          <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-white text-sm font-bold">
                            {friend.first_name?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <p className="flex-1 text-left text-sm font-medium">{friend.first_name}</p>
                        {selected && (
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <Send className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Send button */}
              <div className="p-4 border-t border-border">
                <Button
                  className="w-full rounded-full bg-primary text-primary-foreground gap-2"
                  disabled={!canSend || sending}
                  onClick={handleSend}
                >
                  <Send className="h-4 w-4" />
                  {sending ? 'Sending...' : `Send${canSend ? ` (${selectedFriends.size + (sendToStory ? 1 : 0)})` : ''}`}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex-1 relative overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-10">
              <Button variant="ghost" size="icon" className="text-white bg-black/30 rounded-full" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-white bg-black/30 rounded-full" onClick={() => setFlashEnabled(!flashEnabled)}>
                {flashEnabled ? <Zap className="h-5 w-5 text-primary" /> : <ZapOff className="h-5 w-5" />}
              </Button>
            </div>
          </div>
          <div className="p-6 flex items-center justify-center gap-8 bg-black">
            <div className="w-12" />
            <button
              onClick={takePhoto}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform"
            >
              <div className="w-16 h-16 rounded-full bg-white" />
            </button>
            <Button variant="ghost" size="icon" className="text-white" onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')}>
              <SwitchCamera className="h-6 w-6" />
            </Button>
          </div>
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
