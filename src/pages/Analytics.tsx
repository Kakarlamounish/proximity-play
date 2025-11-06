import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  Users,
  MessageSquare,
  MapPin,
  Award,
  Activity,
  Heart,
  Eye,
  Calendar,
} from 'lucide-react';
import { PageSkeleton } from '@/components/ui/skeleton-loader';
import Navigation from '@/components/Navigation';

interface AnalyticsData {
  totalBubbles: number;
  totalFriends: number;
  totalMessages: number;
  totalStories: number;
  storiesViews: number;
  storiesReactions: number;
  badgesEarned: number;
  activeDays: number;
}

export default function Analytics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalBubbles: 0,
    totalFriends: 0,
    totalMessages: 0,
    totalStories: 0,
    storiesViews: 0,
    storiesReactions: 0,
    badgesEarned: 0,
    activeDays: 0,
  });
  const [badges, setBadges] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [user]);

  const loadAnalytics = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Load all analytics data in parallel with error handling
      const [
        bubblesData,
        friendsData,
        messagesData,
        storiesData,
        badgesData,
      ] = await Promise.all([
        supabase.from('bubble_memberships').select('*', { count: 'exact' }).eq('user_id', user.id),
        supabase
          .from('friendships')
          .select('*', { count: 'exact' })
          .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`),
        supabase.from('messages').select('*', { count: 'exact' }).eq('sender_id', user.id),
        supabase.from('location_stories').select('*', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('user_badges').select('*, badge:badges(*)').eq('user_id', user.id),
      ]);

      // Get story views count separately
      const storiesIds = storiesData.data?.map(s => s.id) || [];
      let viewsCount = 0;
      let reactionsCount = 0;

      if (storiesIds.length > 0) {
        const viewsResult = await supabase
          .from('story_views')
          .select('*', { count: 'exact', head: true })
          .in('story_id', storiesIds);
        viewsCount = viewsResult.count || 0;

        const reactionsResult = await supabase
          .from('story_reactions')
          .select('*', { count: 'exact', head: true })
          .in('story_id', storiesIds);
        reactionsCount = reactionsResult.count || 0;
      }

      // Get recent activities
      const activitiesData = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      const createdAt = user.created_at ? new Date(user.created_at).getTime() : Date.now();
      const activeDays = Math.max(1, Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24)));

      setAnalytics({
        totalBubbles: bubblesData.count || 0,
        totalFriends: friendsData.count || 0,
        totalMessages: messagesData.count || 0,
        totalStories: storiesData.count || 0,
        storiesViews: viewsCount,
        storiesReactions: reactionsCount,
        badgesEarned: badgesData.data?.length || 0,
        activeDays,
      });

      setBadges(badgesData.data || []);
      setRecentActivities(activitiesData?.data || []);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({
    title,
    value,
    icon: Icon,
    description,
    trend,
  }: {
    title: string;
    value: number;
    icon: any;
    description?: string;
    trend?: number;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className="h-3 w-3 text-green-500" />
            <span className="text-xs text-green-500">+{trend}% from last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Track your activity and engagement</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="badges">Badges</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Bubbles Joined"
                value={analytics.totalBubbles}
                icon={MapPin}
                description="Active communities"
                trend={12}
              />
              <StatCard
                title="Friends"
                value={analytics.totalFriends}
                icon={Users}
                description="Connected users"
                trend={8}
              />
              <StatCard
                title="Messages Sent"
                value={analytics.totalMessages}
                icon={MessageSquare}
                description="Total conversations"
                trend={25}
              />
              <StatCard
                title="Stories Posted"
                value={analytics.totalStories}
                icon={Activity}
                description="Shared moments"
                trend={15}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Account Activity</CardTitle>
                <CardDescription>Your presence on the platform</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Active Days</span>
                    <span className="text-sm text-muted-foreground">{analytics.activeDays} days</span>
                  </div>
                  <Progress value={(analytics.activeDays / 365) * 100} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Badges Earned</span>
                    <span className="text-sm text-muted-foreground">
                      {analytics.badgesEarned} / 20
                    </span>
                  </div>
                  <Progress value={(analytics.badgesEarned / 20) * 100} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="engagement" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title="Story Views"
                value={analytics.storiesViews}
                icon={Eye}
                description="People saw your stories"
              />
              <StatCard
                title="Story Reactions"
                value={analytics.storiesReactions}
                icon={Heart}
                description="Hearts on your stories"
              />
              <StatCard
                title="Engagement Rate"
                value={
                  analytics.totalStories > 0
                    ? Math.round((analytics.storiesReactions / analytics.totalStories) * 100)
                    : 0
                }
                icon={TrendingUp}
                description="Average reactions per story"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Engagement Overview</CardTitle>
                <CardDescription>How people interact with your content</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average views per story</span>
                    <Badge variant="secondary">
                      {analytics.totalStories > 0
                        ? Math.round(analytics.storiesViews / analytics.totalStories)
                        : 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Most active in</span>
                    <Badge variant="secondary">Bubbles</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Response rate</span>
                    <Badge variant="secondary">Fast</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="badges" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Badges Earned</CardTitle>
                <CardDescription>
                  You've earned {analytics.badgesEarned} badges so far
                </CardDescription>
              </CardHeader>
              <CardContent>
                {badges.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No badges earned yet. Keep exploring!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {badges.map((userBadge) => (
                      <div
                        key={userBadge.id}
                        className="flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="text-4xl mb-2">{userBadge.badge.icon}</div>
                        <h3 className="font-semibold text-sm text-center">
                          {userBadge.badge.name}
                        </h3>
                        <p className="text-xs text-muted-foreground text-center mt-1">
                          {userBadge.badge.description}
                        </p>
                        <Badge variant="outline" className="mt-2 text-xs">
                          {new Date(userBadge.earned_at).toLocaleDateString()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your latest actions</CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivities.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 pb-4 border-b last:border-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Activity className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.activity_type}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(activity.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
