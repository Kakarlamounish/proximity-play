import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Menu, X } from 'lucide-react';

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
        const user = (data as any)?.user ?? null;
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
          (profile as any)?.full_name ||
          (profile as any)?.username ||
          user.email ||
          user.id ||
          'User';
        const avatar =
          (profile as any)?.avatar_url || (user.user_metadata as any)?.avatar_url || null;

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
        (listener as any)?.subscription?.unsubscribe?.();
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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-secondary/95 to-primary/95 backdrop-blur-md border-b border-border/20 shadow-xl rounded-b-2xl overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center space-x-3">
              <img src="/logo.svg" alt="Social Bubble" className="h-8 w-8" />
              <span className="text-xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
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
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(link.to)
                    ? 'bg-white/20 text-white shadow-md'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right Side - Desktop */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              to="/settings"
              className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200"
              aria-label="Settings"
            >
              ⚙️
            </Link>

            <Link to="/profile" className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white/10 transition-all duration-200">
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/20">
                <img
                  src={avatarUrl ?? '/placeholder.svg'}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-sm font-medium text-white/90 max-w-32 truncate">
                {userName ?? 'User'}
              </span>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-gradient-to-r from-secondary/98 to-primary/98 backdrop-blur-md">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-base font-medium transition-all duration-200 ${
                    isActive(link.to)
                      ? 'bg-white/20 text-white shadow-md'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              <div className="border-t border-white/10 pt-3 mt-3">
                <Link
                  to="/settings"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center space-x-3 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200"
                >
                  <span>⚙️</span>
                  <span>Settings</span>
                </Link>

                <Link
                  to="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center space-x-3 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200"
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/20">
                    <img
                      src={avatarUrl ?? '/placeholder.svg'}
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="font-medium">{userName ?? 'User'}</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

// keep default export for existing default imports
export default Navigation;