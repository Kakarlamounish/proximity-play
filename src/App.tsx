import React, { useEffect, Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import SkipLinks from "@/components/SkipLinks";
import WebVitals from "@/components/WebVitals";
import { Loader2 } from "lucide-react";
import './i18n';
import { sentry } from '@/utils/sentry';

// Lazy load pages for better performance
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const Messages = lazy(() => import("./pages/Messages"));
const Live = lazy(() => import("./pages/Live"));
const Calls = lazy(() => import("./pages/Calls"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Stories = lazy(() => import("./pages/Stories"));
const Maps = lazy(() => import("./pages/Maps"));
const Discover = lazy(() => import("./pages/Discover"));
const Friends = lazy(() => import("./pages/Friends"));
const NotFound = lazy(() => import("./pages/NotFound"));
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
        if (listener && typeof listener === 'object' && 'subscription' in listener) {
          (listener as { subscription?: { unsubscribe?: () => void } }).subscription?.unsubscribe?.();
        }
      } catch {
        // Ignore cleanup errors
      }
    };
  }, []);

  // Loading component for Suspense fallback
  const PageLoader = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-primary">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <SkipLinks />
            <WebVitals onReport={(metric) => {
              // Send to analytics service
              console.log('Web Vitals:', metric);
              // In production, send to analytics like Google Analytics, Mixpanel, etc.
            }} />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
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
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
