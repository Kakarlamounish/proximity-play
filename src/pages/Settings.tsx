import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings as SettingsIcon, Moon, Sun, Bell, Shield, MapPin, Trash2, Download, HelpCircle, UserX, Globe, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UpdateLocationDialog } from '@/components/UpdateLocationDialog';


const Settings = () => {
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Database['public']['Tables']['profiles']['Row'] | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState({
    messages: true,
    meetups: true,
    bubbles: true,
    push: true,
    email: false,
  });
  const [blockedUsers, setBlockedUsers] = useState<Array<{ blocked_id: string; profiles?: { id: string; first_name: string; profile_photo_url: string } }>>([]);
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('UTC');
  const [storageUsed, setStorageUsed] = useState(0);

  // Load preferences from localStorage
  useEffect(() => {
    const savedNotifications = localStorage.getItem('notification-preferences');
    const savedLanguage = localStorage.getItem('app-language');
    const savedTimezone = localStorage.getItem('app-timezone');

    if (savedNotifications) {
      try {
        setNotifications(JSON.parse(savedNotifications));
      } catch (error) {
        console.error('Error loading notification preferences:', error);
      }
    }

    if (savedLanguage) setLanguage(savedLanguage);
    if (savedTimezone) setTimezone(savedTimezone);
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

  useEffect(() => {
    // Initialize dark mode from localStorage (default to dark)
    let isDark = true;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') isDark = false;
    setDarkMode(isDark);
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, []);
  
  const toggleDarkMode = (checked?: boolean) => {
    const newDarkMode = typeof checked === 'boolean' ? checked : !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
    if (newDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete user profile (this will cascade delete related data)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: 'Account deleted',
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
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      const { data: bubbleData } = await supabase
        .from('bubble_memberships')
        .select('*, bubbles(*)')
        .eq('user_id', user?.id);

      const { data: messageData } = await supabase
        .from('messages')
        .select('*')
        .eq('sender_id', user?.id);

      const exportData = {
        profile: profileData,
        bubbles: bubbleData,
        messages: messageData,
        exportDate: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `social-bubble-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Data exported',
        description: 'Your data has been downloaded successfully.',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
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

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-primary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-primary">
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
            <Card className="backdrop-blur-sm bg-card/95 border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {darkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
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
                    checked={darkMode}
                    onCheckedChange={(checked) => toggleDarkMode(Boolean(checked))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card className="backdrop-blur-sm bg-card/95 border-0">
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
                     <Label htmlFor="push-notif" className="text-base">Push Notifications</Label>
                     <p className="text-sm text-muted-foreground">Receive push notifications on your device</p>
                   </div>
                   <Switch
                     id="push-notif"
                     checked={notifications.push}
                     onCheckedChange={(checked) => 
                       updateNotifications({ ...notifications, push: checked })
                     }
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

            {/* Privacy */}
            <Card className="backdrop-blur-sm bg-card/95 border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Privacy & Safety
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Location Sharing</Label>
                    <p className="text-sm text-muted-foreground">Share your location to find nearby bubbles</p>
                  </div>
                  <Switch defaultChecked />
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

            {/* Preferences */}
            <Card className="backdrop-blur-sm bg-card/95 border-0">
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
              </CardContent>
            </Card>

            {/* Blocked Users */}
            <Card className="backdrop-blur-sm bg-card/95 border-0">
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

            {/* Storage & Data */}
            <Card className="backdrop-blur-sm bg-card/95 border-0">
              <CardHeader>
                <CardTitle>Storage & Data</CardTitle>
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
                  // Refresh profile data after location update
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
                  Export Data
                </Button>
              </CardContent>
            </Card>

            {/* Help & Support */}
            <Card className="backdrop-blur-sm bg-card/95 border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Help & Support
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="ghost" className="w-full justify-start">
                  Privacy Policy
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  Terms of Service
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  Contact Support
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  Report a Bug
                </Button>
              </CardContent>
            </Card>

            {/* Account Actions */}
            <Card className="backdrop-blur-sm bg-card/95 border-0">
              <CardHeader>
                <CardTitle>Account Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full" onClick={signOut}>
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
            <Card className="backdrop-blur-sm bg-card/95 border-0">
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
    </div>
  );
};

export default Settings;