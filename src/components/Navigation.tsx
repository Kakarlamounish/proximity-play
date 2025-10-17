import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export function Navigation(): JSX.Element {
  const [userName, setUserName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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

  return (
    <nav className="app-nav">
      <div className="nav-left">
        <Link to="/">
          <img src="/logo.png" alt="Social Bubble" className="nav-logo" />
        </Link>
        <span className="app-title">Social Bubble</span>
      </div>

      <div className="nav-center">
        <Link to="/">Home</Link>
        <Link to="/messages">Messages</Link>
        <Link to="/live">Live</Link>
        <Link to="/stories">Stories</Link>
      </div>

      <div className="nav-right">
        <Link to="/settings" className="nav-icon" aria-label="Settings">
          ⚙️
        </Link>

        <Link to="/profile" className="nav-user">
          <div className="nav-user-avatar">
            <img
              src={avatarUrl ?? '/avatar-placeholder.png'}
              alt="avatar"
              style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
            />
          </div>
          <div className="nav-user-name">{userName ?? 'User'}</div>
        </Link>
      </div>
    </nav>
  );
}

// keep default export for existing default imports
export default Navigation;