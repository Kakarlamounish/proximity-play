import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Menu, X } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationCenter } from '@/components/NotificationCenter';

export function Navigation(): JSX.Element {
  const [userName, setUserName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const loadUserAndProfile = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user ?? null;
        if (!user) {
          if (mounted) {
            setUserName(null);
            setAvatarUrl(null);
          }
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, username, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        const display =
          profile?.full_name ||
          profile?.username ||
          user.email ||
          user.id ||
          'User';
        const avatar =
          profile?.avatar_url || user.user_metadata?.avatar_url || null;

        if (mounted) {
          setUserName(display);
          setAvatarUrl(avatar);
        }
      } catch (err) {
        console.error('Navigation load error', err);
        if (mounted) {
          setUserName(null);
          setAvatarUrl(null);
        }
      }
    };

    loadUserAndProfile();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUserName(null);
        setAvatarUrl(null);
      } else {
        loadUserAndProfile();
      }
    });

    return () => {
      mounted = false;
      try {
        listener?.subscription?.unsubscribe?.();
      // eslint-disable-next-line no-empty
      } catch {}
    };
  }, []);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/discover', label: 'Discover' },
    { to: '/messages', label: 'Messages' },
    { to: '/live', label: 'Live' },
    { to: '/stories', label: 'Stories' },
    { to: '/maps', label: 'Maps' },
    { to: '/friends', label: 'Friends' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-secondary/90 via-primary/90 to-secondary/90 backdrop-blur-lg border-b border-white/10 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center space-x-4">
              <Link to="/" className="flex items-center space-x-3 group">
                <img src="/logo.svg" alt="Social Bubble" className="h-8 w-8 transition-transform group-hover:scale-105" />
                <span className="text-xl font-bold bg-gradient-to-r from-white to-white/90 bg-clip-text text-transparent group-hover:from-white group-hover:to-white transition-all duration-200">
                  Social Bubble
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative overflow-hidden ${
                    isActive(link.to)
                      ? 'bg-white/20 text-white shadow-md'
                      : 'text-white/80 hover:text-white hover:bg-white/10 hover:scale-105'
                  }`}
                >
                  {link.label}
                  {isActive(link.to) && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent rounded-lg animate-pulse" />
                  )}
                </Link>
              ))}
            </div>

            {/* Right Side - Desktop */}
            <div className="hidden md:flex items-center space-x-2">
              <NotificationCenter />
              <ThemeToggle />
              
              <Link
                to="/settings"
                className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200"
                aria-label="Settings"
              >
                ⚙️
              </Link>

              <Link to="/profile" className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white/10 transition-all duration-200 group">
                <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/20 group-hover:border-white/40 transition-colors">
                  <img
                    src={avatarUrl ?? '/placeholder.svg'}
                    alt="avatar"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <span className="text-sm font-medium text-white/90 group-hover:text-white max-w-32 truncate transition-colors">
                  {userName ?? 'User'}
                </span>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200 transform hover:scale-105"
                aria-label="Toggle menu"
              >
                <div className="relative w-6 h-6">
                  <Menu
                    size={24}
                    className={`absolute inset-0 transition-all duration-200 ${isMobileMenuOpen ? 'rotate-180 opacity-0 scale-75' : 'rotate-0 opacity-100 scale-100'}`}
                  />
                  <X
                    size={24}
                    className={`absolute inset-0 transition-all duration-200 ${isMobileMenuOpen ? 'rotate-0 opacity-100 scale-100' : '-rotate-180 opacity-0 scale-75'}`}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <div className={`md:hidden fixed top-16 left-0 right-0 z-50 bg-gradient-to-r from-secondary/98 via-primary/98 to-secondary/98 backdrop-blur-xl border-b border-white/10 shadow-2xl transition-all duration-300 ease-in-out ${
          isMobileMenuOpen
            ? 'opacity-100 visible transform translate-y-0'
            : 'opacity-0 invisible transform -translate-y-4 pointer-events-none'
        }`}>
          <div className="px-4 pt-4 pb-6 space-y-2 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                  isActive(link.to)
                    ? 'bg-white/20 text-white shadow-lg border border-white/20'
                    : 'text-white/80 hover:text-white hover:bg-white/10 active:bg-white/20'
                }`}
              >
                {link.label}
              </Link>
            ))}

            <div className="border-t border-white/10 pt-4 mt-4">
              <Link
                to="/settings"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-4 py-3 rounded-xl text-white/80 hover:text-white hover:bg-white/10 active:bg-white/20 transition-all duration-200"
              >
                <span className="text-lg">⚙️</span>
                <span className="font-medium">Settings</span>
              </Link>

              <Link
                to="/profile"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-4 py-3 rounded-xl text-white/80 hover:text-white hover:bg-white/10 active:bg-white/20 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 flex-shrink-0">
                  <img
                    src={avatarUrl ?? '/placeholder.svg'}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium block truncate text-white">{userName ?? 'User'}</span>
                  <span className="text-xs text-white/60">View Profile</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}

// keep default export for existing default imports
export default Navigation;