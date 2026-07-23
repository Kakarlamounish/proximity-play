import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
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

interface BadgeRow {
  id: string;
  earned_at: string;
  badge: {
    name: string;
    icon: string;
    description: string;
  } | null;
}

interface ActivityRow {
  id: string;
  activity_type: string;
  created_at: string;
}

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
  const { user, loading: authLoading } = useAuth();
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
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityRow[]>([]);

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
    icon: React.ComponentType<{ className?: string }>;
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

  // Auth guard — previously checked the local analytics-data `loading` flag
  // instead of the auth context's own `loading`. Since `loadAnalytics()` is
  // only invoked when `user` is already truthy, a logged-out visitor's local
  // `loading` never flips to false, so `!loading` was always false and this
  // redirect never fired — found via live QA testing (a logged-out visit to
  // `/analytics` was stuck on the skeleton forever instead of redirecting).
  if (!user && !authLoading) return <Navigate to="/auth" replace />;

  // Visual bar chart for activity breakdown
  const UsageChart = () => {
    const items = [
      { label: 'Messages', value: analytics.totalMessages, color: 'bg-blue-500' },
      { label: 'Stories', value: analytics.totalStories, color: 'bg-purple-500' },
      { label: 'Bubbles', value: analytics.totalBubbles, color: 'bg-green-500' },
      { label: 'Friends', value: analytics.totalFriends, color: 'bg-orange-500' },
    ];
    const max = Math.max(...items.map(i => i.value), 1);
    return (
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.label}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium">{item.label}</span>
              <span className="text-muted-foreground font-mono">{item.value.toLocaleString()}</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${item.color} transition-all duration-700`}
                style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 4 : 0)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

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
              />
              <StatCard
                title="Friends"
                value={analytics.totalFriends}
                icon={Users}
                description="Connected users"
              />
              <StatCard
                title="Messages Sent"
                value={analytics.totalMessages}
                icon={MessageSquare}
                description="Total conversations"
              />
              <StatCard
                title="Stories Posted"
                value={analytics.totalStories}
                icon={Activity}
                description="Shared moments"
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
                  <Progress value={Math.min((analytics.activeDays / 365) * 100, 100)} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Badges Earned</span>
                    <span className="text-sm text-muted-foreground">
                      {analytics.badgesEarned} earned
                    </span>
                  </div>
                  <Progress value={analytics.badgesEarned > 0 ? Math.min((analytics.badgesEarned / Math.max(analytics.badgesEarned + 3, 10)) * 100, 100) : 0} />
                </div>
              </CardContent>
            </Card>

            {/* Activity Breakdown Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Breakdown</CardTitle>
                <CardDescription>How you spend your time on Proximity Play</CardDescription>
              </CardHeader>
              <CardContent>
                <UsageChart />
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
                    <span className="text-sm">Most active feature</span>
                    <Badge variant="secondary">
                      {analytics.totalMessages >= analytics.totalStories && analytics.totalMessages >= analytics.totalBubbles
                        ? 'Chat'
                        : analytics.totalStories >= analytics.totalBubbles
                        ? 'Stories'
                        : 'Bubbles'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total interactions</span>
                    <Badge variant="secondary">
                      {(analytics.totalMessages + analytics.storiesReactions + analytics.storiesViews).toLocaleString()}
                    </Badge>
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
                    {badges.filter((userBadge) => userBadge.badge).map((userBadge) => (
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
