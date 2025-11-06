import React, { useEffect, Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import SkipLinks from "@/components/SkipLinks";
import WebVitals from "@/components/WebVitals";
import { PageSkeleton } from "@/components/ui/skeleton-loader";
import { OnboardingTour } from "@/components/OnboardingTour";
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { Button } from "@/components/ui/button";
import './i18n';

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
const Install = lazy(() => import("./pages/Install"));
const Analytics = lazy(() => import("./pages/Analytics"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  // Safely use service worker with error handling
  let isUpdateAvailable = false;
  let updateServiceWorker = () => {};
  
  try {
    const swHook = useServiceWorker();
    isUpdateAvailable = swHook.isUpdateAvailable;
    updateServiceWorker = swHook.updateServiceWorker;
  } catch (error) {
    console.warn('Service Worker not available:', error);
  }

  // Loading component for Suspense fallback
  const PageLoader = () => <PageSkeleton />;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <SkipLinks />
            <OnboardingTour />
            <WebVitals onReport={(metric) => {
              // Send to analytics service
              console.log('Web Vitals:', metric);
              // In production, send to analytics like Google Analytics, Mixpanel, etc.
            }} />
            
            {/* Service Worker Update Notification */}
            {isUpdateAvailable && (
              <div className="fixed bottom-4 right-4 z-50 max-w-sm">
                <div className="backdrop-blur-sm bg-card/95 border rounded-lg p-4 shadow-lg">
                  <h3 className="font-semibold mb-2">Update Available</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    A new version is available. Refresh to get the latest features and improvements.
                  </p>
                  <Button
                    onClick={updateServiceWorker}
                    className="w-full bg-gradient-to-r from-secondary to-primary"
                  >
                    Update Now
                  </Button>
                </div>
              </div>
            )}
            
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <div className="min-h-screen pt-16 bg-gradient-to-br from-secondary via-background to-primary dark:from-secondary-dark dark:via-background dark:to-primary-dark">
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
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/install" element={<Install />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </div>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
