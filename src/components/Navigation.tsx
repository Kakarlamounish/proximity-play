import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Home, MessageSquare, User as UserIcon, Settings, LogOut, Activity, Phone, BookOpen, MapIcon, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationCenter } from '@/components/NotificationCenter';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/discover', icon: Activity, label: 'Discover' },
    { path: '/friends', icon: UserIcon, label: 'Friends' },
    { path: '/messages', icon: MessageSquare, label: 'Messages' },
    { path: '/maps', icon: MapIcon, label: 'Maps' },
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
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="App Logo"
              className="w-8 h-8 rounded-lg object-cover"
            />
            <h1 className="text-base sm:text-lg font-bold bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
              Social Bubble
            </h1>
          </div>

          {/* Navigation - Desktop with labels */}
          <div className="hidden xl:flex items-center gap-1">
            {navItems.map(({ path, icon: Icon, label }) => (
              <Button
                key={path}
                variant={isActive(path) ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate(path)}
                className={`h-8 px-3 ${isActive(path) ? "bg-gradient-to-r from-secondary to-primary" : ""}`}
              >
                <Icon className="h-3.5 w-3.5 mr-1.5" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
          
          {/* Navigation - Tablet/Laptop with icons only */}
          <div className="hidden md:flex xl:hidden items-center gap-0.5 overflow-x-auto">
            {navItems.map(({ path, icon: Icon, label }) => (
              <Button
                key={path}
                variant={isActive(path) ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate(path)}
                className={`h-8 px-2 shrink-0 ${isActive(path) ? "bg-gradient-to-r from-secondary to-primary" : ""}`}
                title={label}
              >
                <Icon className="h-4 w-4" />
              </Button>
            ))}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <NotificationCenter />
            
            <div className="hidden md:flex items-center gap-2">
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
            
            <Button variant="outline" size="sm" onClick={signOut} className="hidden lg:flex">
              <LogOut className="h-4 w-4" />
            </Button>

            {/* Mobile/Tablet Menu Trigger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <SheetHeader>
                  <SheetTitle className="text-left">Menu</SheetTitle>
                </SheetHeader>
                
                <div className="flex flex-col gap-1 mt-6">
                  {/* User Profile Section */}
                  <div className="flex items-center gap-3 p-3 mb-4 bg-muted rounded-lg">
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarImage src={profile?.profile_photo_url} />
                      <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-white">
                        {(profile?.first_name?.[0] || profile?.email?.[0] || 'U').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium truncate">
                        {profile?.first_name || 'User'}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {profile?.email}
                      </span>
                    </div>
                  </div>

                  {/* Navigation Items */}
                  {navItems.map(({ path, icon: Icon, label }) => (
                    <Button
                      key={path}
                      variant={isActive(path) ? "default" : "ghost"}
                      className={`justify-start gap-3 ${
                        isActive(path) ? "bg-gradient-to-r from-secondary to-primary" : ""
                      }`}
                      onClick={() => handleNavigation(path)}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{label}</span>
                    </Button>
                  ))}

                  {/* Sign Out Button */}
                  <Button
                    variant="outline"
                    className="justify-start gap-3 mt-4"
                    onClick={() => {
                      signOut();
                      setMobileMenuOpen(false);
                    }}
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Sign Out</span>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

      </div>
    </div>
  );
};