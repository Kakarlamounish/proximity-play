import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings as SettingsIcon, Moon, Sun, Bell, Shield, MapPin, Trash2, Download, HelpCircle, UserX, Globe, Clock, Ghost, Eye, EyeOff, Timer, Users, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UpdateLocationDialog } from '@/components/UpdateLocationDialog';
import { BiometricAuth } from '@/components/BiometricAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/utils/notificationPreferences';
import { Link } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';


const Settings = () => {
  const { user, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteDataOpen, setDeleteDataOpen] = useState(false);
  const [profile, setProfile] = useState<Database['public']['Tables']['profiles']['Row'] | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATION_PREFERENCES);
  const { permission: pushPermission, isSubscribed: pushSubscribed, subscribe: subscribePush, unsubscribe: unsubscribePush } = usePushNotifications();
  const [blockedUsers, setBlockedUsers] = useState<Array<{ blocked_id: string; profiles?: { id: string; first_name: string; profile_photo_url: string } }>>([]);
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('UTC');
  const [storageUsed, setStorageUsed] = useState(0);
  const [callTimeoutSeconds, setCallTimeoutSeconds] = useState(30);

  // Privacy state
  const [ghostMode, setGhostMode] = useState(
    () => localStorage.getItem('ghost-mode') === 'true'
  );
  const [blurLocation, setBlurLocation] = useState(
    () => localStorage.getItem('blur-location') === 'true'
  );
  const [trustedOnly, setTrustedOnly] = useState(
    () => localStorage.getItem('trusted-only') === 'true'
  );
  const [shareTimerActive, setShareTimerActive] = useState(false);
  const [shareTimerEnd, setShareTimerEnd] = useState<Date | null>(null);

  const CALL_TIMEOUT_STORAGE_KEY = 'call-timeout-seconds';

  // Load preferences from localStorage
  useEffect(() => {
    const savedNotifications = localStorage.getItem('notification-preferences');
    const savedLanguage = localStorage.getItem('app-language');
    const savedTimezone = localStorage.getItem('app-timezone');
    const savedCallTimeout = localStorage.getItem(CALL_TIMEOUT_STORAGE_KEY);

    if (savedNotifications) {
      try {
        setNotifications(JSON.parse(savedNotifications));
      } catch (error) {
        console.error('Error loading notification preferences:', error);
      }
    }

    if (savedLanguage) setLanguage(savedLanguage);
    if (savedTimezone) setTimezone(savedTimezone);

    if (savedCallTimeout) {
      const n = Number(savedCallTimeout);
      if (Number.isFinite(n) && n > 0) setCallTimeoutSeconds(n);
    }
  }, []);

  // Save preferences to localStorage
  const updateNotifications = (newNotifications: typeof notifications) => {
    setNotifications(newNotifications);
    localStorage.setItem('notification-preferences', JSON.stringify(newNotifications));
  };

  const updateLanguage = (newLanguage: string) => {
    setLanguage(newLanguage);
    localStorage.setItem('app-language', newLanguage);
  };

  const updateTimezone = (newTimezone: string) => {
    setTimezone(newTimezone);
    localStorage.setItem('app-timezone', newTimezone);
  };

  const updateCallTimeout = (seconds: number) => {
    setCallTimeoutSeconds(seconds);
    localStorage.setItem(CALL_TIMEOUT_STORAGE_KEY, String(seconds));
  };

  const toggleGhostMode = (val: boolean) => {
    setGhostMode(val);
    localStorage.setItem('ghost-mode', String(val));
    // This toggle previously only set localStorage, which the Maps page's
    // own Ghost Mode switch (correctly wired to `profiles.ghost_mode`, the
    // column other users' visibility actually depends on) never saw — found
    // via live QA testing: toggling this control left the Maps switch
    // showing unchecked, meaning other users could still see your location
    // despite the "Completely hide your location from everyone" promise.
    if (user) {
      supabase
        .from('profiles')
        .update({ ghost_mode: val })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) {
            console.error('Error updating ghost mode:', error);
            toast({
              title: 'Error',
              description: 'Failed to update ghost mode on the server',
              variant: 'destructive',
            });
          }
        });
    }
  };

  const toggleBlurLocation = (val: boolean) => {
    setBlurLocation(val);
    localStorage.setItem('blur-location', String(val));
    toast({ title: val ? 'Location blurred (~100m accuracy)' : 'Exact location restored' });
  };

  const toggleTrustedOnly = (val: boolean) => {
    setTrustedOnly(val);
    localStorage.setItem('trusted-only', String(val));
  };

  const SHARE_TIMER_STORAGE_KEY = 'share-timer-end';

  const finishShareTimer = () => {
    setShareTimerActive(false);
    setShareTimerEnd(null);
    localStorage.removeItem(SHARE_TIMER_STORAGE_KEY);
    toggleGhostMode(true);
    toast({ title: '👻 Ghost Mode activated', description: 'Your timed share has ended' });
  };

  const armShareTimer = (end: Date) => {
    setShareTimerEnd(end);
    setShareTimerActive(true);
    const remainingMs = end.getTime() - Date.now();
    setTimeout(finishShareTimer, Math.max(0, remainingMs));
  };

  const startShareTimer = (hours: number) => {
    const end = new Date(Date.now() + hours * 3600000);
    localStorage.setItem(SHARE_TIMER_STORAGE_KEY, String(end.getTime()));
    armShareTimer(end);
    toast({
      title: `⏱️ Sharing for ${hours}h`,
      description: `Your location will be hidden after ${end.toLocaleTimeString()}`,
    });
  };

  // Resume a timed share across navigation/remount — the timer was
  // previously plain in-memory state, so leaving Settings and coming back
  // (or reloading) silently lost it, meaning a user who started a 24h timed
  // share and closed the tab would never get auto-ghosted. Found via live
  // QA testing: "Sharing until" was showing right after starting a timer,
  // then gone after navigating away and back to Settings.
  useEffect(() => {
    const storedEnd = localStorage.getItem(SHARE_TIMER_STORAGE_KEY);
    if (!storedEnd) return;
    const end = new Date(Number(storedEnd));
    if (end.getTime() <= Date.now()) {
      // The timer should have already fired while this page wasn't mounted
      // to run its setTimeout — catch up immediately instead of losing it.
      finishShareTimer();
    } else {
      armShareTimer(end);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setProfile(profileData);

        // Fetch blocked users
        const { data: blocks } = await supabase
          .from('user_blocks')
          .select('blocked_id')
          .eq('blocker_id', user.id);

        if (blocks && blocks.length > 0) {
          const { data: blockedProfiles } = await supabase
            .from('profiles')
            .select('id, first_name, profile_photo_url')
            .in('id', blocks.map(b => b.blocked_id));

          const blocksWithProfiles = blocks.map(block => ({
            ...block,
            profiles: blockedProfiles?.find(p => p.id === block.blocked_id)
          }));
          
          setBlockedUsers(blocksWithProfiles || []);
        } else {
          setBlockedUsers([]);
        }

        // Calculate storage usage
        try {
          const { data: photos } = await supabase.storage
            .from('profile-photos')
            .list(user.id);
          
          if (photos) {
            const totalSize = photos.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
            setStorageUsed(Math.round(totalSize / 1024 / 1024 * 100) / 100); // MB
          }
        } catch (error) {
          console.error('Error calculating storage usage:', error);
          setStorageUsed(0);
        }

      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setProfileLoading(false);
      }
    };

    if (user && !loading) {
      fetchProfile();
    }
  }, [user, loading]);

  // Theme is now managed by ThemeContext - no need for local state

  const handleSignOut = () => {
    setSignOutOpen(true);
  };

  const handleDeleteAccount = () => {
    setDeleteAccountOpen(true);
  };

  const executeDeleteAccount = async () => {
    setDeleteAccountOpen(false);
    try {
      // Delete user profile (this will cascade delete related data)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: 'Account deleted 🗑️',
        description: 'Your account has been permanently deleted.',
      });

      // Sign out after deletion
      await signOut();
    } catch (error) {
      toast({
        title: 'Error deleting account',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleExportData = async () => {
    try {
      const [profileRes, bubbleRes, messageRes, locationRes, tripRes, dropRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user?.id).single(),
        supabase.from('bubble_memberships').select('*, bubbles(*)').eq('user_id', user?.id),
        supabase.from('messages').select('*').eq('sender_id', user?.id),
        supabase.from('location_history').select('*').eq('user_id', user?.id).limit(5000),
        supabase.from('trips').select('*').eq('created_by', user?.id),
        supabase.from('dead_drops').select('*').eq('created_by', user?.id),
      ]);

      const exportData = {
        profile: profileRes.data,
        bubbles: bubbleRes.data,
        messages: messageRes.data,
        locationHistory: locationRes.data,
        trips: tripRes.data,
        deadDrops: dropRes.data,
        exportDate: new Date().toISOString(),
        // Was "This is all data stored about you" — false: this export
        // never included received messages (only messages.sender_id=you),
        // badges, snap scores/streaks, blocks, webauthn credentials, or
        // push subscriptions. Found via live QA testing (downloaded and
        // inspected the actual exported file). Softened the claim rather
        // than adding queries for every remaining table in this pass, to
        // avoid overclaiming completeness that still wouldn't be accurate
        // without a full audit of every user-referencing table.
        gdprNote: 'This includes your profile, bubble memberships, sent messages, recent location history, trips, and dead drops. It may not include every table that references your account. You can request full deletion at any time.',
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proximity-play-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Data exported 📥',
        description: 'Your complete data has been downloaded (GDPR compliant).',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAllData = () => {
    setDeleteDataOpen(true);
  };

  const executeDeleteAllData = async () => {
    setDeleteDataOpen(false);
    try {
      await Promise.all([
        supabase.from('location_history').delete().eq('user_id', user?.id),
        supabase.from('trips').delete().eq('created_by', user?.id),
        supabase.from('dead_drops').delete().eq('created_by', user?.id),
      ]);
      toast({ title: '🗑️ Data deleted', description: 'Your location history, trips and drops have been removed' });
    } catch (err: any) {
      toast({ title: 'Deletion failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleUnblockUser = async (blockedId: string) => {
    try {
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', user?.id)
        .eq('blocked_id', blockedId);

      if (error) throw error;

      setBlockedUsers(prev => prev.filter((block) => block.blocked_id !== blockedId));
      
      toast({
        title: 'User unblocked',
        description: 'The user has been unblocked successfully.',
      });
    } catch (error) {
      toast({
        title: 'Failed to unblock',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  // Redirect unauthenticated users
  if (!user && !loading) {
    return <Navigate to="/auth" replace />;
  }

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <SettingsIcon className="h-8 w-8" />
              Settings
            </h1>
            <p className="text-muted-foreground">Manage your preferences and account</p>
          </div>

          <div className="space-y-6">
            {/* Appearance */}
            <Card className="glass border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  Appearance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="dark-mode" className="text-base">Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">Toggle between light and dark themes</p>
                  </div>
                  <Switch
                    id="dark-mode"
                    checked={theme === 'dark'}
                    onCheckedChange={toggleTheme}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card className="glass border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="messages-notif" className="text-base">Messages</Label>
                    <p className="text-sm text-muted-foreground">Get notified about new messages</p>
                  </div>
                   <Switch
                     id="messages-notif"
                     checked={notifications.messages}
                     onCheckedChange={(checked) => 
                       updateNotifications({ ...notifications, messages: checked })
                     }
                   />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="chatsound-notif" className="text-base">Chat Sound</Label>
                    <p className="text-sm text-muted-foreground">Play a sound when a new chat arrives</p>
                  </div>
                  <Switch
                    id="chatsound-notif"
                    checked={notifications.chatSound}
                    onCheckedChange={(checked) =>
                      updateNotifications({ ...notifications, chatSound: checked })
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="unread-notif" className="text-base">Unread Badges</Label>
                    <p className="text-sm text-muted-foreground">Show red unread counts on friend pins & bar</p>
                  </div>
                  <Switch
                    id="unread-notif"
                    checked={notifications.unreadBadges}
                    onCheckedChange={(checked) =>
                      updateNotifications({ ...notifications, unreadBadges: checked })
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="meetups-notif" className="text-base">Meetups</Label>
                    <p className="text-sm text-muted-foreground">Get notified about meetup invites</p>
                  </div>
                   <Switch
                     id="meetups-notif"
                     checked={notifications.meetups}
                     onCheckedChange={(checked) => 
                       updateNotifications({ ...notifications, meetups: checked })
                     }
                   />
                </div>
                 <Separator />
                 <div className="flex items-center justify-between">
                   <div>
                     <Label htmlFor="bubbles-notif" className="text-base">Bubble Suggestions</Label>
                     <p className="text-sm text-muted-foreground">Get notified about new bubble suggestions</p>
                   </div>
                   <Switch
                     id="bubbles-notif"
                     checked={notifications.bubbles}
                     onCheckedChange={(checked) => 
                       updateNotifications({ ...notifications, bubbles: checked })
                     }
                   />
                 </div>
                 <Separator />
                 <div className="flex items-center justify-between">
                   <div>
                     <Label htmlFor="calls-notif" className="text-base">Calls</Label>
                     <p className="text-sm text-muted-foreground">Get notified about missed calls</p>
                   </div>
                   <Switch
                     id="calls-notif"
                     checked={notifications.calls}
                     onCheckedChange={(checked) =>
                       updateNotifications({ ...notifications, calls: checked })
                     }
                   />
                 </div>
                 <Separator />
                 <div className="flex items-center justify-between">
                   <div>
                     <Label htmlFor="friend-requests-notif" className="text-base">Friend Requests</Label>
                     <p className="text-sm text-muted-foreground">Get notified about friend requests</p>
                   </div>
                   <Switch
                     id="friend-requests-notif"
                     checked={notifications.friendRequests}
                     onCheckedChange={(checked) =>
                       updateNotifications({ ...notifications, friendRequests: checked })
                     }
                   />
                 </div>
                 <Separator />
                 <div className="flex items-center justify-between">
                   <div>
                     <Label htmlFor="stories-notif" className="text-base">Stories</Label>
                     <p className="text-sm text-muted-foreground">Get notified about reactions to your stories</p>
                   </div>
                   <Switch
                     id="stories-notif"
                     checked={notifications.stories}
                     onCheckedChange={(checked) =>
                       updateNotifications({ ...notifications, stories: checked })
                     }
                   />
                 </div>
                 <Separator />
                 <div className="flex items-center justify-between">
                   <div>
                     <Label htmlFor="push-notif" className="text-base">Push Notifications</Label>
                     <p className="text-sm text-muted-foreground">
                       {pushPermission === 'denied'
                         ? 'Blocked in your browser settings'
                         : 'Receive push notifications on your device'}
                     </p>
                   </div>
                   <Switch
                     id="push-notif"
                     checked={notifications.push && pushSubscribed}
                     disabled={pushPermission === 'denied'}
                     onCheckedChange={async (checked) => {
                       const ok = checked ? await subscribePush() : await unsubscribePush();
                       if (checked && !ok) return; // permission denied or unsupported — leave toggle off
                       updateNotifications({ ...notifications, push: checked });
                     }}
                   />
                 </div>
                 <Separator />
                 <div className="flex items-center justify-between">
                   <div>
                     <Label htmlFor="email-notif" className="text-base">Email Notifications</Label>
                     <p className="text-sm text-muted-foreground">Receive important updates via email</p>
                   </div>
                   <Switch
                     id="email-notif"
                     checked={notifications.email}
                     onCheckedChange={(checked) => 
                       updateNotifications({ ...notifications, email: checked })
                     }
                   />
                 </div>
              </CardContent>
            </Card>

            {/* Privacy & Safety - Enhanced */}
            <Card className="glass border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Privacy & Safety
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Ghost Mode */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="ghost-mode" className="text-base flex items-center gap-2">
                      👻 Ghost Mode
                    </Label>
                    <p className="text-sm text-muted-foreground">Completely hide your location from everyone</p>
                  </div>
                  <Switch
                    id="ghost-mode"
                    checked={ghostMode}
                    onCheckedChange={toggleGhostMode}
                  />
                </div>

                <Separator />

                {/* Blur Location */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="blur-location" className="text-base">
                      📌 Blur Exact Location
                    </Label>
                    <p className="text-sm text-muted-foreground">Show your area (~100m) instead of exact GPS</p>
                  </div>
                  <Switch
                    id="blur-location"
                    checked={blurLocation}
                    onCheckedChange={toggleBlurLocation}
                  />
                </div>

                <Separator />

                {/* Trusted Friends Only */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="trusted-only" className="text-base">
                      👥 Trusted Friends Only
                    </Label>
                    <p className="text-sm text-muted-foreground">Only close friends can see your location</p>
                  </div>
                  <Switch
                    id="trusted-only"
                    checked={trustedOnly}
                    onCheckedChange={toggleTrustedOnly}
                  />
                </div>

                <Separator />

                {/* Timed Share */}
                <div>
                  <Label className="text-base">⏱️ Share for Limited Time</Label>
                  <p className="text-sm text-muted-foreground mb-3">Enable location sharing for a set duration, then auto-ghost</p>
                  {shareTimerActive && shareTimerEnd ? (
                    <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-500/10 rounded-lg px-3 py-2">
                      <Clock className="h-4 w-4" />
                      Sharing until {shareTimerEnd.toLocaleTimeString()}
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {[1, 4, 8, 24].map(h => (
                        <Button
                          key={h}
                          size="sm"
                          variant="outline"
                          onClick={() => startShareTimer(h)}
                          disabled={ghostMode}
                        >
                          {h}h
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Profile Visibility</Label>
                    <p className="text-sm text-muted-foreground">Show your profile to other bubble members</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            {/* Biometric / Security Keys */}
            <BiometricAuth mode="register" />

            {/* Preferences */}
            <Card className="glass border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Language</Label>
                    <p className="text-sm text-muted-foreground">Choose your preferred language</p>
                  </div>
                  <Select value={language} onValueChange={updateLanguage}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Timezone</Label>
                    <p className="text-sm text-muted-foreground">Set your local timezone</p>
                  </div>
                  <Select value={timezone} onValueChange={updateTimezone}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">EST</SelectItem>
                      <SelectItem value="America/Los_Angeles">PST</SelectItem>
                      <SelectItem value="Europe/London">GMT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Call timeout</Label>
                    <p className="text-sm text-muted-foreground">
                      Auto-mark unanswered calls as missed after this many seconds
                    </p>
                  </div>
                  <Select value={String(callTimeoutSeconds)} onValueChange={(v) => updateCallTimeout(Number(v))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15s</SelectItem>
                      <SelectItem value="30">30s</SelectItem>
                      <SelectItem value="45">45s</SelectItem>
                      <SelectItem value="60">60s</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Blocked Users */}
            <Card className="glass border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserX className="h-5 w-5" />
                  Blocked Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                {blockedUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No blocked users
                  </p>
                ) : (
                  <div className="space-y-3">
                    {blockedUsers.map((block) => (
                      <div key={block.blocked_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                            {block.profiles?.first_name?.[0] || '?'}
                          </div>
                          <span className="font-medium">{block.profiles?.first_name || 'Unknown User'}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnblockUser(block.blocked_id)}
                        >
                          Unblock
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Storage & Data - Enhanced */}
            <Card className="glass border-0">
              <CardHeader>
                <CardTitle>Storage & Data (GDPR)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Storage Used</Label>
                    <p className="text-sm text-muted-foreground">{storageUsed} MB of photos</p>
                  </div>
                  <div className="text-sm font-medium">{storageUsed} MB</div>
                </div>

                <Separator />

                <UpdateLocationDialog onLocationUpdate={() => {
                  if (user) {
                    supabase
                      .from('profiles')
                      .select('*')
                      .eq('id', user.id)
                      .single()
                      .then(({ data }) => setProfile(data));
                  }
                }} />

                <Button variant="outline" className="w-full justify-start" onClick={handleExportData}>
                  <Download className="h-4 w-4 mr-2" />
                  Export All My Data (JSON)
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive border-destructive/50 hover:bg-destructive/10"
                  onClick={handleDeleteAllData}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Location History & Activity
                </Button>
              </CardContent>
            </Card>

            {/* Help & Support */}
            <Card className="glass border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Help & Support
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Previously had no onClick at all — silently did nothing
                    when tapped, which is a bad look especially for "Report a
                    Bug" during a QA pass. Found via live QA testing. */}
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => toast({ title: 'Coming soon', description: 'This page is not available yet.' })}
                >
                  Privacy Policy
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => toast({ title: 'Coming soon', description: 'This page is not available yet.' })}
                >
                  Terms of Service
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => toast({ title: 'Coming soon', description: 'Support contact is not available yet.' })}
                >
                  Contact Support
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => toast({ title: 'Coming soon', description: 'Bug reporting is not available yet.' })}
                >
                  Report a Bug
                </Button>
              </CardContent>
            </Card>

            {/* Account Actions */}
            <Card className="glass border-0">
              <CardHeader>
                <CardTitle>Account Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full" onClick={handleSignOut}>
                  Sign Out
                </Button>
                
                <Separator />
                
                <Button 
                  variant="destructive" 
                  className="w-full justify-start"
                  onClick={handleDeleteAccount}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </CardContent>
            </Card>

            {/* App Info */}
            <Card className="glass border-0">
              <CardContent className="pt-6">
                <div className="text-center text-sm text-muted-foreground">
                  <p>Social Bubble v1.0.0</p>
                  <p className="mt-2">Connect with people who share your interests</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent className="glass border-white/10 text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Sign Out</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to sign out? You will need to sign in again to access your proximity matches and chats.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="bg-muted text-foreground hover:bg-muted/80 border-0 rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setSignOutOpen(false);
                signOut();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-0 rounded-xl"
            >
              Yes, Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <AlertDialogContent className="glass border-white/10 text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-destructive">Delete Account</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete your account? This action is permanent, cannot be undone, and will delete all your profile details, matches, and chats.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="bg-muted text-foreground hover:bg-muted/80 border-0 rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-0 rounded-xl"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Data Confirmation Dialog */}
      <AlertDialog open={deleteDataOpen} onOpenChange={setDeleteDataOpen}>
        <AlertDialogContent className="glass border-white/10 text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-destructive">Delete History & Activity</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete ALL your location history, trips, and dead drops? This action cannot be undone. Your account and profile will remain active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="bg-muted text-foreground hover:bg-muted/80 border-0 rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDeleteAllData}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-0 rounded-xl"
            >
              Delete All Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;