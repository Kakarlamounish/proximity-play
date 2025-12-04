import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, MapPin, Users, Check, X, HelpCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Meetup = Database['public']['Tables']['meetups']['Row'] & {
  organizer?: {
    first_name: string | null;
    profile_photo_url: string | null;
  };
  rsvp_counts?: {
    going: number;
    maybe: number;
    not_going: number;
  };
  user_rsvp?: Database['public']['Enums']['rsvp_status'] | null;
};

interface MeetupsListProps {
  bubbleId: string;
}

export const MeetupsList: React.FC<MeetupsListProps> = ({ bubbleId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);

  const fetchMeetups = async () => {
    if (!bubbleId) return;

    try {
      // Fetch meetups
      const { data: meetupsData, error } = await supabase
        .from('meetups')
        .select('*')
        .eq('bubble_id', bubbleId)
        .gte('date_time', new Date().toISOString())
        .order('date_time', { ascending: true });

      if (error) throw error;

      if (!meetupsData || meetupsData.length === 0) {
        setMeetups([]);
        return;
      }

      // Fetch organizer profiles
      const organizerIds = [...new Set(meetupsData.map(m => m.organizer_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, profile_photo_url')
        .in('id', organizerIds);

      // Fetch RSVPs for all meetups
      const meetupIds = meetupsData.map(m => m.id);
      const { data: rsvps } = await supabase
        .from('meetup_rsvps')
        .select('meetup_id, status, user_id')
        .in('meetup_id', meetupIds);

      // Map meetups with additional data
      const meetupsWithData: Meetup[] = meetupsData.map(meetup => {
        const organizer = profiles?.find(p => p.id === meetup.organizer_id);
        const meetupRsvps = rsvps?.filter(r => r.meetup_id === meetup.id) || [];
        
        return {
          ...meetup,
          organizer: organizer ? {
            first_name: organizer.first_name,
            profile_photo_url: organizer.profile_photo_url,
          } : undefined,
          rsvp_counts: {
            going: meetupRsvps.filter(r => r.status === 'going').length,
            maybe: meetupRsvps.filter(r => r.status === 'maybe').length,
            not_going: meetupRsvps.filter(r => r.status === 'not_going').length,
          },
          user_rsvp: meetupRsvps.find(r => r.user_id === user?.id)?.status || null,
        };
      });

      setMeetups(meetupsWithData);
    } catch (error) {
      console.error('Error fetching meetups:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetups();
  }, [bubbleId, user?.id]);

  const handleRsvp = async (meetupId: string, status: Database['public']['Enums']['rsvp_status']) => {
    if (!user) return;

    setRsvpLoading(meetupId);
    try {
      // Check if user already has an RSVP
      const { data: existing } = await supabase
        .from('meetup_rsvps')
        .select('id')
        .eq('meetup_id', meetupId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update existing RSVP
        const { error } = await supabase
          .from('meetup_rsvps')
          .update({ status })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new RSVP
        const { error } = await supabase
          .from('meetup_rsvps')
          .insert({
            meetup_id: meetupId,
            user_id: user.id,
            status,
          });

        if (error) throw error;
      }

      toast({
        title: 'RSVP Updated',
        description: `You've marked yourself as ${status.replace('_', ' ')}`,
      });

      // Refresh meetups
      fetchMeetups();
    } catch (error: any) {
      toast({
        title: 'Error updating RSVP',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRsvpLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (meetups.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No upcoming meetups</p>
        <p className="text-sm">Create one to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {meetups.map((meetup) => (
        <Card key={meetup.id} className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-semibold text-foreground">{meetup.title}</h4>
                {meetup.description && (
                  <p className="text-sm text-muted-foreground mt-1">{meetup.description}</p>
                )}
              </div>
              <Badge 
                variant={meetup.status === 'upcoming' ? 'secondary' : 'outline'}
                className="capitalize"
              >
                {meetup.status}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(meetup.date_time), 'PPP p')}</span>
              </div>
              {meetup.location_name && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{meetup.location_name}</span>
                </div>
              )}
              {meetup.organizer && (
                <div className="flex items-center gap-1">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={meetup.organizer.profile_photo_url || undefined} />
                    <AvatarFallback className="text-[8px]">
                      {meetup.organizer.first_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span>{meetup.organizer.first_name}</span>
                </div>
              )}
            </div>

            {/* RSVP Counts */}
            <div className="flex gap-4 mb-4 text-sm">
              <div className="flex items-center gap-1 text-green-500">
                <Check className="h-4 w-4" />
                <span>{meetup.rsvp_counts?.going || 0} going</span>
              </div>
              <div className="flex items-center gap-1 text-yellow-500">
                <HelpCircle className="h-4 w-4" />
                <span>{meetup.rsvp_counts?.maybe || 0} maybe</span>
              </div>
              <div className="flex items-center gap-1 text-red-500">
                <X className="h-4 w-4" />
                <span>{meetup.rsvp_counts?.not_going || 0} not going</span>
              </div>
            </div>

            {/* RSVP Buttons */}
            <div className="flex gap-2">
              <Button
                variant={meetup.user_rsvp === 'going' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleRsvp(meetup.id, 'going')}
                disabled={rsvpLoading === meetup.id}
                className={meetup.user_rsvp === 'going' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {rsvpLoading === meetup.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Going
                  </>
                )}
              </Button>
              <Button
                variant={meetup.user_rsvp === 'maybe' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleRsvp(meetup.id, 'maybe')}
                disabled={rsvpLoading === meetup.id}
                className={meetup.user_rsvp === 'maybe' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
              >
                <HelpCircle className="h-4 w-4 mr-1" />
                Maybe
              </Button>
              <Button
                variant={meetup.user_rsvp === 'not_going' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleRsvp(meetup.id, 'not_going')}
                disabled={rsvpLoading === meetup.id}
                className={meetup.user_rsvp === 'not_going' ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                <X className="h-4 w-4 mr-1" />
                Not Going
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
