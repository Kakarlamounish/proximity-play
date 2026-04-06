import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, SwitchCamera, X, Send, Download, Zap, ZapOff } from 'lucide-react';

interface CameraScreenProps {
  onCapture?: (imageDataUrl: string) => void;
  onClose?: () => void;
}

export function CameraScreen({ onCapture, onClose }: CameraScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);

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

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (flashEnabled) {
      // Flash effect
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

  const handleSend = () => {
    if (capturedImage && onCapture) {
      onCapture(capturedImage);
    }
    setCapturedImage(null);
  };

  const handleDiscard = () => {
    setCapturedImage(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Flash overlay */}
      <div id="camera-flash" className="absolute inset-0 bg-white z-50 pointer-events-none opacity-0 transition-opacity duration-150" />

      {capturedImage ? (
        /* Preview captured image */
        <div className="flex-1 relative">
          <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
          <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-6 px-6">
            <Button
              variant="ghost"
              size="icon"
              className="w-14 h-14 rounded-full bg-destructive/80 text-white hover:bg-destructive"
              onClick={handleDiscard}
            >
              <X className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-14 h-14 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleSend}
            >
              <Send className="h-6 w-6" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 left-4 text-white bg-black/30 rounded-full"
            onClick={handleDiscard}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        /* Camera viewfinder */
        <>
          <div className="flex-1 relative overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Top controls */}
            <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-10">
              <Button
                variant="ghost"
                size="icon"
                className="text-white bg-black/30 rounded-full"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white bg-black/30 rounded-full"
                onClick={() => setFlashEnabled(!flashEnabled)}
              >
                {flashEnabled ? <Zap className="h-5 w-5 text-primary" /> : <ZapOff className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {/* Bottom controls */}
          <div className="p-6 flex items-center justify-center gap-8 bg-black">
            <div className="w-12" /> {/* spacer */}
            <button
              onClick={takePhoto}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform"
            >
              <div className="w-16 h-16 rounded-full bg-white" />
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white"
              onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')}
            >
              <SwitchCamera className="h-6 w-6" />
            </Button>
          </div>
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
