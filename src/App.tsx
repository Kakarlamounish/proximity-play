import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { CallProvider } from "@/contexts/CallContext";
import SkipLinks from "@/components/SkipLinks";
import { PageSkeleton } from "@/components/ui/skeleton-loader";
import { FriendRequestNotifier } from '@/components/FriendRequestNotifier';
import { PresenceTracker } from '@/components/PresenceTracker';

// Lazy load pages
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
const JoinBubble = lazy(() => import("./pages/JoinBubble"));
const MissedCalls = lazy(() => import("./pages/MissedCalls"));
const NotFound = lazy(() => import("./pages/NotFound"));

import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => <PageSkeleton />;

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <CallProvider>
              <TooltipProvider>
                <SkipLinks />
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <FriendRequestNotifier />
                  <PresenceTracker />
                  <div id="main-content" role="main" className="min-h-screen pt-16 bg-background">
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
                        <Route path="/missed-calls" element={<MissedCalls />} />
                        <Route path="/join/:inviteCode" element={<JoinBubble />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </div>
                </BrowserRouter>
              </TooltipProvider>
            </CallProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
