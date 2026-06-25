import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, Camera, Map, Users, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const tabs = [
  { to: '/messages', icon: MessageSquare, label: 'Chat' },
  { to: '/', icon: Map, label: 'Map' },
  { to: '/camera', icon: Camera, label: '', isCenter: true },
  { to: '/stories', icon: Users, label: 'Stories' },
  { to: '/?sheet=profile', icon: User, label: 'Profile' },
];

export function SnapBottomNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  
  // Hide on camera page or if unauthenticated
  if (!user || pathname === '/camera') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border safe-bottom md:hidden">
      <div className="flex items-center justify-around h-14 px-2">
        {tabs.map(tab => {
          const active = pathname === tab.to;
          const Icon = tab.icon;

          if (tab.isCenter) {
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className="flex items-center justify-center w-14 h-14 -mt-5 rounded-full bg-primary text-primary-foreground shadow-snap active:scale-90 transition-transform"
                aria-label="Camera"
              >
                <Icon className="h-7 w-7" />
              </Link>
            );
          }

          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
