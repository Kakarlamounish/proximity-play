import React, { Suspense, lazy, useEffect } from "react";
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
import { RealtimeNotificationListener } from '@/components/RealtimeNotificationListener';
import { PresenceTracker } from '@/components/PresenceTracker';
import { SnapBottomNav } from '@/components/SnapBottomNav';
import { SmartStatusChip } from '@/components/SmartStatusChip';
import { BatterySaverBanner } from '@/components/BatterySaverBanner';
import { PWALocationBanner } from '@/components/PWALocationBanner';
import { QuickActionsFAB } from '@/components/QuickActionsFAB';

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
const Camera = lazy(() => import("./pages/Camera"));
const ARView = lazy(() => import("./pages/ARView"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Premium = lazy(() => import("./pages/Premium"));

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

// A referral link looks like /?ref=CODE. Stash the code so ProfileSetup can
// redeem it once the visitor actually creates an account — by then the query
// param is long gone (through the auth redirect), so it can't be read there.
function capturePendingReferral() {
  const code = new URLSearchParams(window.location.search).get('ref');
  if (code && !localStorage.getItem('pending_referral_code')) {
    localStorage.setItem('pending_referral_code', code);
  }
}

function App() {
  useEffect(() => {
    capturePendingReferral();
  }, []);

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
                  <RealtimeNotificationListener />
                  <PresenceTracker />
                  {/* Global floating UI */}
                  <BatterySaverBanner />
                  <PWALocationBanner />
                  <SmartStatusChip />
                  <div id="main-content" role="main" className="min-h-screen bg-background">
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route path="/" element={<ErrorBoundary><Maps /></ErrorBoundary>} />
                        <Route path="/dashboard" element={<ErrorBoundary><Index /></ErrorBoundary>} />
                        <Route path="/auth" element={<ErrorBoundary><Auth /></ErrorBoundary>} />
                        <Route path="/profile-setup" element={<ErrorBoundary><ProfileSetup /></ErrorBoundary>} />
                        <Route path="/discover" element={<ErrorBoundary><Discover /></ErrorBoundary>} />
                        <Route path="/friends" element={<ErrorBoundary><Friends /></ErrorBoundary>} />
                        <Route path="/messages" element={<ErrorBoundary><Messages /></ErrorBoundary>} />
                        <Route path="/live" element={<ErrorBoundary><Live /></ErrorBoundary>} />
                        <Route path="/calls" element={<ErrorBoundary><Calls /></ErrorBoundary>} />
                        <Route path="/stories" element={<ErrorBoundary><Stories /></ErrorBoundary>} />
                        <Route path="/profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
                        <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
                        <Route path="/analytics" element={<ErrorBoundary><Analytics /></ErrorBoundary>} />
                        <Route path="/install" element={<ErrorBoundary><Install /></ErrorBoundary>} />
                        <Route path="/missed-calls" element={<ErrorBoundary><MissedCalls /></ErrorBoundary>} />
                        <Route path="/camera" element={<ErrorBoundary><Camera /></ErrorBoundary>} />
                        <Route path="/join/:inviteCode" element={<ErrorBoundary><JoinBubble /></ErrorBoundary>} />
                        {/* New routes */}
                        <Route path="/ar" element={<ErrorBoundary><ARView /></ErrorBoundary>} />
                        <Route path="/leaderboard" element={<ErrorBoundary><Leaderboard /></ErrorBoundary>} />
                        <Route path="/premium" element={<ErrorBoundary><Premium /></ErrorBoundary>} />
                        <Route path="*" element={<ErrorBoundary><NotFound /></ErrorBoundary>} />
                      </Routes>
                    </Suspense>
                  </div>
                  <QuickActionsFAB />
                  <SnapBottomNav />
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
