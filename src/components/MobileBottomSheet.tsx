import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapPoints?: number[];
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  snapPoints = [0.25, 0.5, 0.9],
}) => {
  const [currentSnap, setCurrentSnap] = useState(snapPoints[1]);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startSnap = useRef(0);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setCurrentSnap(snapPoints[1]);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, snapPoints]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    startSnap.current = currentSnap;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const currentY = e.touches[0].clientY;
    const diff = startY.current - currentY;
    const windowHeight = window.innerHeight;
    const newSnap = Math.max(0, Math.min(1, startSnap.current + diff / windowHeight));
    
    setCurrentSnap(newSnap);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);

    // Snap to nearest point
    const nearest = snapPoints.reduce((prev, curr) =>
      Math.abs(curr - currentSnap) < Math.abs(prev - currentSnap) ? curr : prev
    );

    // Close if dragged below threshold
    if (nearest < 0.2) {
      onClose();
    } else {
      setCurrentSnap(nearest);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        style={{
          opacity: isOpen ? 1 : 0,
        }}
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="fixed left-0 right-0 bottom-0 z-50 bg-card rounded-t-3xl shadow-2xl transition-transform"
        style={{
          transform: `translateY(${(1 - currentSnap) * 100}%)`,
          maxHeight: '90vh',
          touchAction: 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-3 border-b">
            <h2 className="text-lg font-semibold">{title}</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          {children}
        </div>
      </div>
    </>
  );
};
