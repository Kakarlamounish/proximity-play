import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { FriendsMap } from '@/components/FriendsMap';
import { SmartStatusChip } from '@/components/SmartStatusChip';
import { Loader2, Flame, Navigation as NavIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

const Maps = () => {
  const { user, loading } = useAuth();

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
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-6 mt-16 lg:mt-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <NavIcon className="text-primary h-7 w-7" />
              Snap Map
            </h1>
            <p className="text-muted-foreground mt-1">See what your friends are up to in real-time.</p>
          </div>
          <Link 
            to="/memory-lane"
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-xl font-semibold transition-all shadow-sm"
          >
            <Flame className="w-5 h-5 text-orange-500" />
            View Memory Lane
          </Link>
        </div>
        <FriendsMap />
      </div>
      <SmartStatusChip />
    </div>
  );
};

export default Maps;

