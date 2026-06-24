import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Menu, X, Camera } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationCenter } from '@/components/NotificationCenter';
import { SearchDialog } from '@/components/SearchDialog';
import { useAuth } from '@/contexts/AuthContext';

export function Navigation(): JSX.Element {
  const { user: authUser } = useAuth();
  const [userName, setUserName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const loadUserAndProfile = async () => {
      if (!authUser) {
        if (mounted) { setUserName(null); setAvatarUrl(null); }
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('first_name, profile_photo_url')
          .eq('id', authUser.id)
          .maybeSingle();

        if (error) console.error('Navigation: Profile fetch error', error);

        const display = profile?.first_name || authUser.email || 'User';
        const avatar = profile?.profile_photo_url || authUser.user_metadata?.avatar_url || null;

        if (mounted) { setUserName(display); setAvatarUrl(avatar); }
      } catch (err) {
        console.error('Navigation: Unexpected load error', err);
        if (mounted) { setUserName(null); setAvatarUrl(null); }
      }
    };

    loadUserAndProfile();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setUserName(null); setAvatarUrl(null); }
      else loadUserAndProfile();
    });

    return () => {
      mounted = false;
      try { listener?.subscription?.unsubscribe?.(); } catch {}
    };
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;

    const fetchCount = async () => {
      const { count } = await supabase
        .from('friend_requests')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', authUser.id)
        .eq('status', 'pending');
      setPendingRequestCount(count ?? 0);
    };

    fetchCount();

    const channel = supabase
      .channel('nav-friend-request-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${authUser.id}` }, () => fetchCount())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [authUser]);

  interface NavItem { to: string; label: string; badge?: number; }

  const navLinks: NavItem[] = [
    { to: '/', label: '🏠 Home' },
    { to: '/messages', label: '💬 Chat' },
    { to: '/discover', label: '🔍 Discover' },
    { to: '/stories', label: '📖 Stories' },
    { to: '/maps', label: '🗺️ Snap Map' },
    { to: '/friends', label: '👥 Friends', badge: pendingRequestCount },
    { to: '/calls', label: '📞 Calls' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b-0 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 gap-2">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0">
              <Link to="/" className="flex items-center space-x-2 group">
                <span className="text-2xl select-none" aria-hidden="true">👻</span>
                <span className="text-lg font-extrabold tracking-tight text-foreground group-hover:text-primary transition-colors duration-150 hidden sm:inline">
                  Proximity Play
                </span>
              </Link>
              <Link
                to="/camera"
                className="ml-3 p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/80 transition-all hidden sm:flex items-center justify-center"
                aria-label="Open Camera"
              >
                <Camera className="h-4 w-4" />
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1 flex-1 justify-center overflow-x-auto no-scrollbar mx-2">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`relative px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap ${
                    isActive(link.to)
                      ? 'bg-primary text-primary-foreground shadow-snap'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {link.label}
                  {link.badge !== undefined && link.badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                      {link.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <NotificationCenter />

              <div className="hidden lg:flex items-center gap-1">
                <SearchDialog />
                <ThemeToggle />

                <Link
                  to="/settings"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-all duration-150"
                  aria-label="Settings"
                >
                  ⚙️
                </Link>

                <Link to="/profile" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted transition-all duration-150 group">
                  <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-primary/40 group-hover:border-primary transition-colors flex-shrink-0">
                    <img src={avatarUrl ?? '/placeholder.svg'} alt="avatar" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground max-w-24 truncate transition-colors hidden xl:inline">
                    {userName ?? 'User'}
                  </span>
                </Link>
              </div>

              <div className="lg:hidden flex items-center gap-1">
                <SearchDialog />
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                  aria-label="Toggle menu"
                >
                  <div className="relative w-5 h-5">
                    <Menu size={20} className={`absolute inset-0 transition-all duration-200 ${isMobileMenuOpen ? 'rotate-180 opacity-0 scale-75' : 'rotate-0 opacity-100 scale-100'}`} />
                    <X size={20} className={`absolute inset-0 transition-all duration-200 ${isMobileMenuOpen ? 'rotate-0 opacity-100 scale-100' : '-rotate-180 opacity-0 scale-75'}`} />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <div className={`lg:hidden fixed top-14 left-0 right-0 z-50 glass transition-all duration-300 ease-in-out ${
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
                className={`relative block px-4 py-3 rounded-xl text-base font-semibold transition-all duration-150 ${
                  isActive(link.to)
                    ? 'bg-primary text-primary-foreground shadow-snap'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {link.label}
                {link.badge !== undefined && link.badge > 0 && (
                  <span className="inline-flex ml-2 min-w-[20px] h-[20px] items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold px-1">
                    {link.badge}
                  </span>
                )}
              </Link>
            ))}

            <div className="border-t border-border pt-4 mt-4">
              <Link
                to="/memory-lane"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-4 py-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
              >
                <span className="text-lg">🔥</span>
                <span className="font-medium">Memory Lane</span>
              </Link>
              <Link
                to="/ar"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-4 py-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
              >
                <span className="text-lg">📷</span>
                <span className="font-medium">AR View</span>
              </Link>

              <Link
                to="/settings"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-4 py-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
              >
                <span className="text-lg">⚙️</span>
                <span className="font-medium">Settings</span>
              </Link>

              <Link
                to="/profile"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-4 py-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
                  <img src={avatarUrl ?? '/placeholder.svg'} alt="avatar" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium block truncate text-foreground">{userName ?? 'User'}</span>
                  <span className="text-xs text-muted-foreground">View Profile</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}

export default Navigation;
