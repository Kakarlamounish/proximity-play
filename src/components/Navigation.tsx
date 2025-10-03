import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Home, MessageSquare, User as UserIcon, Settings, LogOut, Activity, Phone, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationCenter } from '@/components/NotificationCenter';

import type { Database } from '@/integrations/supabase/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';

type ProfilesRow = Database['public']['Tables']['profiles']['Row'];

interface NavigationProps {
  profile?: SupabaseUser & ProfilesRow;
}

export const Navigation: React.FC<NavigationProps> = ({ profile }) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/messages', icon: MessageSquare, label: 'Messages' },
    { path: '/live', icon: Activity, label: 'Live' },
    { path: '/calls', icon: Phone, label: 'Calls' },
    { path: '/stories', icon: BookOpen, label: 'Stories' },
    { path: '/profile', icon: UserIcon, label: 'Profile' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="bg-card/50 backdrop-blur-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="App Logo"
              className="w-10 h-10 rounded-xl object-cover"
            />
            <h1 className="text-xl font-bold bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
              Social Bubble
            </h1>
          </div>

          {/* Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {navItems.map(({ path, icon: Icon, label }) => (
              <Button
                key={path}
                variant={isActive(path) ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate(path)}
                className={isActive(path) ? "bg-gradient-to-r from-secondary to-primary" : ""}
              >
                <Icon className="h-4 w-4 mr-2" />
                {label}
              </Button>
            ))}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <NotificationCenter />
            
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.profile_photo_url} />
                <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-white text-sm">
                  {(profile?.first_name?.[0] || profile?.email?.[0] || 'U').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:block text-sm font-medium">
                {profile?.first_name || profile?.email || 'User'}
              </span>
            </div>
            
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex justify-around py-2 border-t">
          {navItems.map(({ path, icon: Icon, label }) => (
            <Button
              key={path}
              variant="ghost"
              size="sm"
              onClick={() => navigate(path)}
              className={`flex flex-col gap-1 h-auto py-2 ${
                isActive(path) ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs">{label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};