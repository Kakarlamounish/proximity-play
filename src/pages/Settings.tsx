import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Settings as SettingsIcon, Moon, Sun, Bell, Shield, MapPin, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Settings = () => {
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState({
    messages: true,
    meetups: true,
    bubbles: true,
  });

  // Redirect unauthenticated users
  if (!user && !loading) {
    return <Navigate to="/auth" replace />;
  }

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
    // Check for dark mode preference
    const savedTheme = localStorage.getItem('theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(savedTheme === 'dark' || (!savedTheme && systemTheme));
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', newDarkMode);
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
    } catch (error: any) {
      toast({
        title: 'Error deleting account',
        description: error.message,
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
      <Navigation profile={profile} />
      
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
                    onCheckedChange={toggleDarkMode}
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
                      setNotifications(prev => ({ ...prev, messages: checked }))
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
                      setNotifications(prev => ({ ...prev, meetups: checked }))
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
                      setNotifications(prev => ({ ...prev, bubbles: checked }))
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

            {/* Account */}
            <Card className="backdrop-blur-sm bg-card/95 border-0">
              <CardHeader>
                <CardTitle>Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  <MapPin className="h-4 w-4 mr-2" />
                  Update Location
                </Button>
                
                <Button variant="outline" className="w-full justify-start">
                  Export Data
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