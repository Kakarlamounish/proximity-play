import React, { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ProfileSetup from "./pages/ProfileSetup";
import Messages from "./pages/Messages";
import Live from "./pages/Live";
import Calls from "./pages/Calls";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Stories from "./pages/Stories";
import Maps from "./pages/Maps";
import Discover from "./pages/Discover";
import Friends from "./pages/Friends";
import NotFound from "./pages/NotFound";
import { createClient } from '@supabase/supabase-js';

const queryClient = new QueryClient();

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

const App = () => {
  // Force dark mode globally on app load
  React.useEffect(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }, []);
  
  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        if (!data?.session) {
          // if not on auth page, redirect to /auth
          if (!window.location.pathname.startsWith('/auth')) {
            window.location.replace('/auth');
          }
        }
      } catch (err) {
        console.error('Error checking session', err);
      }
    };
    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        if (!window.location.pathname.startsWith('/auth')) {
          window.location.replace('/auth');
        }
      }
    });

    return () => {
      mounted = false;
      try {
        // unsubscribe if available
        (listener as any)?.subscription?.unsubscribe?.();
      } catch {}
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/profile-setup" element={<ProfileSetup />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/live" element={<Live />} />
            <Route path="/calls" element={<Calls />} />
            <Route path="/stories" element={<Stories />} />
            <Route path="/maps" element={<Maps />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
