import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Camera, MapPin, Users, X } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useLocation } from '@/hooks/useLocation';
import { CreateBubbleDialog } from '@/components/CreateBubbleDialog';
import CreateStoryDialog from '@/components/CreateStoryDialog';
import CreateARPinDialog from '@/components/CreateARPinDialog';

export const QuickActionsFAB: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<'bubble' | 'story' | 'ar_pin' | null>(null);
  const haptic = useHapticFeedback();
  const { latitude, longitude } = useLocation();
  const userLocation: [number, number] | null = latitude && longitude ? [latitude, longitude] : null;

  const toggleOpen = () => {
    haptic.light();
    setIsOpen(!isOpen);
  };

  const handleAction = (dialog: 'bubble' | 'story' | 'ar_pin') => {
    haptic.success();
    setActiveDialog(dialog);
    setIsOpen(false);
  };

  const actions = [
    {
      id: 'bubble',
      label: 'Create Bubble',
      icon: <Users className="h-5 w-5" />,
      color: 'bg-blue-500',
    },
    {
      id: 'story',
      label: 'Create Story',
      icon: <Camera className="h-5 w-5" />,
      color: 'bg-pink-500',
    },
    {
      id: 'ar_pin',
      label: 'Drop AR Pin',
      icon: <MapPin className="h-5 w-5" />,
      color: 'bg-green-500',
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Speed Dial Menu */}
      <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-3 pointer-events-none">
        <AnimatePresence>
          {isOpen && (
            <div className="flex flex-col items-end gap-3 mb-2 pointer-events-auto">
              {actions.map((action, index) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.8 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-sm font-medium bg-card px-3 py-1.5 rounded-lg shadow-lg border">
                    {action.label}
                  </span>
                  <button
                    onClick={() => handleAction(action.id as 'bubble' | 'story' | 'ar_pin')}
                    className={`h-12 w-12 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110 active:scale-95 ${action.color}`}
                  >
                    {action.icon}
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Main FAB */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggleOpen}
          className="h-14 w-14 rounded-full bg-gradient-to-r from-secondary to-primary text-white shadow-xl flex items-center justify-center hover:shadow-2xl transition-shadow pointer-events-auto"
        >
          <motion.div
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Plus className="h-6 w-6" />
          </motion.div>
        </motion.button>
      </div>

      {/* Dialogs */}
      <CreateBubbleDialog 
        open={activeDialog === 'bubble'} 
        onOpenChange={(open) => !open && setActiveDialog(null)}
        trigger={<div className="hidden" />} // Hide the default trigger since we control open state
      />
      <CreateStoryDialog 
        open={activeDialog === 'story'} 
        onClose={() => setActiveDialog(null)} 
        userLocation={userLocation} 
      />
      <CreateARPinDialog 
        open={activeDialog === 'ar_pin'} 
        onClose={() => setActiveDialog(null)} 
        userLocation={userLocation} 
      />
    </>
  );
};
