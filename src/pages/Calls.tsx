import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Phone, 
  Video, 
  PhoneCall, 
  Users, 
  Clock,
  Loader2,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  User,
  Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCallContext } from '@/contexts/CallContext';
import { MissedCallBanner, type MissedCallBannerData } from '@/components/MissedCallBanner';
import { MissedCallLogDrawer } from '@/components/MissedCallLogDrawer';
import { CallDetailDialog } from '@/components/CallDetailDialog';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';

interface Profile {
  id: string;
  first_name: string;
  profile_photo_url: string | null;
}

interface Bubble {
  id: string;
  name: string;
  interest_tag: string;
  member_count: number | null;
}

interface CallLog {
  id: string;
  caller_id: string;
  receiver_id: string | null;
  bubble_id: string | null;
  call_type: 'audio' | 'video';
  status: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
}

const CALL_TIMEOUT_STORAGE_KEY = 'call-timeout-seconds';

const Calls = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const { startCall } = useCallContext();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userBubbles, setUserBubbles] = useState<Bubble[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [callHistory, setCallHistory] = useState<CallLog[]>([]);
  const [callerProfiles, setCallerProfiles] = useState<Record<string, Profile>>({});
  const [missedCall, setMissedCall] = useState<MissedCallBannerData | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      // FIX #10: run independent queries in parallel instead of sequentially
      const [profileRes, bubblesRes, friendshipsRes, callLogsRes] = await Promise.all([
        supabase.from('profiles').select('id, first_name, profile_photo_url').eq('id', user.id).maybeSingle(),
        supabase.from('bubble_memberships').select(`bubble:bubbles(id, name, interest_tag, member_count)`).eq('user_id', user.id),
        supabase.from('friendships').select('user_id_1, user_id_2').or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`),
        supabase.from('call_logs').select('*').or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(20),
      ]);

      setProfile(profileRes.data ?? null);

      const bubbles = bubblesRes.data?.map(m => m.bubble).filter(Boolean) as Bubble[] || [];
      setUserBubbles(bubbles);

      // Fetch friend profiles and call participant profiles in parallel
      const friendIds = (friendshipsRes.data ?? []).map(f =>
        f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1
      );

      const callLogs = callLogsRes.data ?? [];
      setCallHistory(callLogs);

      const participantIds = new Set<string>();
      callLogs.forEach(log => {
        if (log.caller_id) participantIds.add(log.caller_id);
        if (log.receiver_id) participantIds.add(log.receiver_id);
      });

      const profileFetches: Promise<any>[] = [];
      if (friendIds.length > 0) {
        profileFetches.push(
          supabase.from('profiles').select('id, first_name, profile_photo_url').in('id', friendIds)
            .then(({ data }) => { setFriends(data || []); })
        );
      }
      if (participantIds.size > 0) {
        profileFetches.push(
          supabase.from('profiles').select('id, first_name, profile_photo_url').in('id', Array.from(participantIds))
            .then(({ data }) => {
              const profileMap: Record<string, Profile> = {};
              data?.forEach(p => { profileMap[p.id] = p; });
              setCallerProfiles(profileMap);
            })
        );
      }
      await Promise.all(profileFetches);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setPageLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && !loading) {
      fetchData();
    }
  }, [user, loading, fetchData]);

  // Removed local startCall, handleAcceptCall, handleDeclineCall, endCall

  const getCallIcon = (log: CallLog) => {
    const isOutgoing = log.caller_id === user?.id;
    
    if (log.status === 'missed' || log.status === 'declined') {
      return <PhoneMissed className="h-4 w-4 text-destructive" />;
    }
    
    return isOutgoing ? (
      <PhoneOutgoing className="h-4 w-4 text-green-500" />
    ) : (
      <PhoneIncoming className="h-4 w-4 text-blue-500" />
    );
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!user && !loading) {
    return <Navigate to="/auth" replace />;
  }

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // VideoCall is now rendered globally inside CallContext

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      {missedCall && (
        <MissedCallBanner
          data={missedCall}
          onDismiss={() => setMissedCall(null)}
          onCallBack={(callerId, type) => {
            setMissedCall(null);
            startCall(callerId, type, false);
          }}
        />
      )}
      
      {/* Incoming Call Notification is now handled by CallContext */}
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-extrabold mb-4 tracking-tight">
              Calls
              <PhoneCall className="inline-block ml-3 h-8 w-8 text-primary" />
            </h1>
            <p className="text-lg text-white/60 font-medium">
              Connect with friends and bubble members through calls
            </p>
          </div>

          <Tabs defaultValue="friends" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="friends">
                <User className="h-4 w-4 mr-2" />
                Friends
              </TabsTrigger>
              <TabsTrigger value="bubbles">
                <Users className="h-4 w-4 mr-2" />
                Bubbles
              </TabsTrigger>
              <TabsTrigger value="history">
                <Clock className="h-4 w-4 mr-2" />
                History
              </TabsTrigger>
            </TabsList>

            {/* Friends Tab */}
            <TabsContent value="friends">
              <Card className="bg-[#0f0f0f] border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-primary/30"></div>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Call a Friend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {friends.length === 0 ? (
                    <div className="text-center py-8">
                      <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-4">No friends yet</p>
                      <Button onClick={() => navigate('/friends')}>
                        Find Friends
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {friends.map((friend) => (
                        <div key={friend.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={friend.profile_photo_url || undefined} />
                              <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-white">
                                {friend.first_name?.[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-medium">{friend.first_name}</h3>
                              <p className="text-sm text-muted-foreground">Available</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startCall(friend.id, 'audio', false)}
                            >
                              <Phone className="h-4 w-4 mr-2" />
                              Audio
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startCall(friend.id, 'video', false)}
                            >
                              <Video className="h-4 w-4 mr-2" />
                              Video
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Bubbles Tab */}
            <TabsContent value="bubbles">
              <Card className="bg-[#0f0f0f] border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-primary/30"></div>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Group Calls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userBubbles.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-4">No bubbles joined</p>
                      <Button onClick={() => window.location.href = '/'}>
                        Find Bubbles
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userBubbles.map((bubble) => (
                        <div key={bubble.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-white">
                                {bubble.name[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-medium">{bubble.name}</h3>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {bubble.interest_tag}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {bubble.member_count || 0} members
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startCall(bubble.id, 'audio', true)}
                            >
                              <Phone className="h-4 w-4 mr-2" />
                              Audio
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startCall(bubble.id, 'video', true)}
                            >
                              <Video className="h-4 w-4 mr-2" />
                              Video
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history">
              <Card className="backdrop-blur-sm bg-card/95 border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Calls
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const rows = callHistory.map(l => {
                            const other = l.caller_id === user?.id ? l.receiver_id : l.caller_id;
                            const p = other ? callerProfiles[other] : null;
                            return [
                              format(new Date(l.created_at), 'yyyy-MM-dd HH:mm'),
                              p?.first_name || 'Unknown',
                              l.call_type,
                              l.status,
                              l.duration_seconds ?? '',
                            ].join(',');
                          });
                          const csv = ['Date,Name,Type,Status,Duration(s)', ...rows].join('\n');
                          const blob = new Blob([csv], { type: 'text/csv' });
                          const a = document.createElement('a');
                          a.href = URL.createObjectURL(blob);
                          a.download = 'call-history.csv';
                          a.click();
                        }}
                        disabled={callHistory.length === 0}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Export
                      </Button>
                      <MissedCallLogDrawer
                        onCallBack={({ friendId, bubbleId, callType }) => {
                          if (bubbleId) startCall(bubbleId, callType, true);
                          else if (friendId) startCall(friendId, callType, false);
                        }}
                      />
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {callHistory.length === 0 ? (
                    <div className="text-center py-8">
                      <PhoneCall className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No call history yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {callHistory.map((log) => {
                        const isOutgoing = log.caller_id === user?.id;
                        const otherUserId = isOutgoing ? log.receiver_id : log.caller_id;
                        const otherUser = otherUserId ? callerProfiles[otherUserId] : null;

                        return (
                          <CallDetailDialog key={log.id} log={log} currentUserId={user!.id} profiles={callerProfiles}>
                            <div className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent/30 transition-colors">
                              <div className="flex items-center gap-3">
                                {getCallIcon(log)}
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={otherUser?.profile_photo_url || undefined} />
                                  <AvatarFallback className="bg-gradient-to-r from-secondary to-primary text-white text-sm">
                                    {otherUser?.first_name?.[0]?.toUpperCase() || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <h4 className="font-medium text-sm">
                                    {otherUser?.first_name || 'Unknown'}
                                  </h4>
                                  <p className="text-xs text-muted-foreground">
                                    {log.call_type} • {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge variant={log.status === 'ended' ? 'secondary' : 'outline'} className="text-xs">
                                  {log.status}
                                </Badge>
                                {log.duration_seconds && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {formatDuration(log.duration_seconds)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CallDetailDialog>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Call Features Info */}
          <Card className="backdrop-blur-sm bg-card/95 border-0 mt-6">
            <CardHeader>
              <CardTitle>Call Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-primary/10 rounded-lg">
                  <Phone className="h-8 w-8 text-primary mb-2" />
                  <h4 className="font-medium mb-2">Audio Calls</h4>
                  <p className="text-sm text-muted-foreground">
                    Crystal clear voice calls with friends and bubble members
                  </p>
                </div>
                <div className="p-4 bg-primary/10 rounded-lg">
                  <Video className="h-8 w-8 text-primary mb-2" />
                  <h4 className="font-medium mb-2">Video Calls</h4>
                  <p className="text-sm text-muted-foreground">
                    Face-to-face conversations with HD video quality
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Calls;
