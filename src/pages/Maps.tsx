import React from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { FriendsMap } from '@/components/FriendsMap';
import { SmartStatusChip } from '@/components/SmartStatusChip';
import { MobileBottomSheet } from '@/components/MobileBottomSheet';
import Messages from './Messages';
import Profile from './Profile';
import Friends from './Friends';
import { MemoryLanePanel } from '@/components/MemoryLanePanel';
import { Loader2, Flame, Navigation as NavIcon } from 'lucide-react';

const Maps = () => {
  const { user, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const currentSheet = searchParams.get('sheet');
  const isSheetOpen = !!currentSheet;

  const closeSheet = () => {
    setSearchParams({});
  };

  if (!user && !loading) {
    return <Navigate to="/auth" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative bg-background overflow-hidden">
      <Navigation />
      
      {/* Absolute positioned floating header over the map */}
      <div className="absolute top-24 left-4 right-4 md:left-8 md:right-auto z-40 pointer-events-none">
        <div className="flex flex-col gap-4">
          <div className="bg-card/80 backdrop-blur-md p-4 rounded-2xl shadow-lg pointer-events-auto border">
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <NavIcon className="text-primary h-6 w-6" />
              Snap Map
            </h1>
            <p className="text-xs text-muted-foreground mt-1">Real-time friends location</p>
          </div>
          
          <Link 
            to="/?sheet=memory-lane"
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-2xl font-semibold transition-all shadow-lg pointer-events-auto w-fit"
          >
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-sm">Memory Lane</span>
          </Link>
        </div>
      </div>

      {/* Edge-to-edge Map Container */}
      <div className="absolute inset-0 z-0">
        <FriendsMap showMemoryLane={currentSheet === 'memory-lane'} />
      </div>
      
      <div className="z-50 pointer-events-auto">
        <SmartStatusChip />
      </div>

      {/* Bottom Sheet Overlays */}
      <MobileBottomSheet
        isOpen={isSheetOpen}
        onClose={closeSheet}
        title={
          currentSheet === 'messages' ? 'Chat' : 
          currentSheet === 'profile' ? 'Profile' : 
          currentSheet === 'friends' ? 'Friends' :
          currentSheet === 'memory-lane' ? 'Memory Lane' : ''
        }
      >
        <div className="h-full overflow-hidden">
          {currentSheet === 'messages' && <Messages isOverlay={true} />}
          {currentSheet === 'profile' && <Profile isOverlay={true} />}
          {currentSheet === 'friends' && <Friends isOverlay={true} />}
          {currentSheet === 'memory-lane' && <MemoryLanePanel />}
        </div>
      </MobileBottomSheet>
    </div>
  );
};

export default Maps;
