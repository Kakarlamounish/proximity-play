-- Complete remaining RLS policies for meetups
DROP POLICY IF EXISTS "Users can view meetups in their bubbles" ON public.meetups;
DROP POLICY IF EXISTS "Users can create meetups in their bubbles" ON public.meetups;
DROP POLICY IF EXISTS "Organizers can update their meetups" ON public.meetups;

CREATE POLICY "Users can view meetups in their bubbles" ON public.meetups 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.bubble_memberships 
        WHERE bubble_id = meetups.bubble_id AND user_id = auth.uid()
    )
);
CREATE POLICY "Users can create meetups in their bubbles" ON public.meetups 
FOR INSERT WITH CHECK (
    auth.uid() = organizer_id AND
    EXISTS (
        SELECT 1 FROM public.bubble_memberships 
        WHERE bubble_id = meetups.bubble_id AND user_id = auth.uid()
    )
);
CREATE POLICY "Organizers can update their meetups" ON public.meetups 
FOR UPDATE USING (auth.uid() = organizer_id);

-- Complete RLS policies for meetup_rsvps
DROP POLICY IF EXISTS "Users can view RSVPs for meetups in their bubbles" ON public.meetup_rsvps;
DROP POLICY IF EXISTS "Users can RSVP to meetups" ON public.meetup_rsvps;
DROP POLICY IF EXISTS "Users can update their RSVPs" ON public.meetup_rsvps;
DROP POLICY IF EXISTS "Users can delete their RSVPs" ON public.meetup_rsvps;

CREATE POLICY "Users can view RSVPs for meetups in their bubbles" ON public.meetup_rsvps 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.meetups m
        JOIN public.bubble_memberships bm ON m.bubble_id = bm.bubble_id
        WHERE m.id = meetup_rsvps.meetup_id AND bm.user_id = auth.uid()
    )
);
CREATE POLICY "Users can RSVP to meetups" ON public.meetup_rsvps 
FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM public.meetups m
        JOIN public.bubble_memberships bm ON m.bubble_id = bm.bubble_id
        WHERE m.id = meetup_rsvps.meetup_id AND bm.user_id = auth.uid()
    )
);
CREATE POLICY "Users can update their RSVPs" ON public.meetup_rsvps 
FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their RSVPs" ON public.meetup_rsvps 
FOR DELETE USING (auth.uid() = user_id);

-- Complete RLS policies for user_blocks
DROP POLICY IF EXISTS "Users can view their blocks" ON public.user_blocks;
DROP POLICY IF EXISTS "Users can block others" ON public.user_blocks;
DROP POLICY IF EXISTS "Users can unblock others" ON public.user_blocks;

CREATE POLICY "Users can view their blocks" ON public.user_blocks FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "Users can block others" ON public.user_blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users can unblock others" ON public.user_blocks FOR DELETE USING (auth.uid() = blocker_id);

-- Complete RLS policies for user_reports
DROP POLICY IF EXISTS "Users can view their reports" ON public.user_reports;
DROP POLICY IF EXISTS "Users can report others" ON public.user_reports;

CREATE POLICY "Users can view their reports" ON public.user_reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Users can report others" ON public.user_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Complete RLS policies for badges and user_badges
DROP POLICY IF EXISTS "Everyone can view badges" ON public.badges;
DROP POLICY IF EXISTS "Users can view all user badges" ON public.user_badges;
DROP POLICY IF EXISTS "Only system can award badges" ON public.user_badges;

CREATE POLICY "Everyone can view badges" ON public.badges FOR SELECT USING (true);
CREATE POLICY "Users can view all user badges" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "Only system can award badges" ON public.user_badges FOR ALL USING (false);

-- Complete storage policies
CREATE POLICY "Users can update their own profile photos" ON storage.objects 
FOR UPDATE USING (
    bucket_id = 'profile-photos' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own profile photos" ON storage.objects 
FOR DELETE USING (
    bucket_id = 'profile-photos' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Create functions for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updating timestamps (drop if exists first)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_bubbles_updated_at ON public.bubbles;
CREATE TRIGGER update_bubbles_updated_at BEFORE UPDATE ON public.bubbles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_meetups_updated_at ON public.meetups;
CREATE TRIGGER update_meetups_updated_at BEFORE UPDATE ON public.meetups
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_meetup_rsvps_updated_at ON public.meetup_rsvps;
CREATE TRIGGER update_meetup_rsvps_updated_at BEFORE UPDATE ON public.meetup_rsvps
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to update bubble member count
CREATE OR REPLACE FUNCTION public.update_bubble_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.bubbles 
        SET member_count = member_count + 1 
        WHERE id = NEW.bubble_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.bubbles 
        SET member_count = member_count - 1 
        WHERE id = OLD.bubble_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update bubble member count (drop if exists first)
DROP TRIGGER IF EXISTS update_bubble_member_count_trigger ON public.bubble_memberships;
CREATE TRIGGER update_bubble_member_count_trigger
    AFTER INSERT OR DELETE ON public.bubble_memberships
    FOR EACH ROW EXECUTE FUNCTION public.update_bubble_member_count();

-- Enable realtime for other tables (skip if already exists)
DO $$
BEGIN
    -- Enable realtime for bubble_memberships
    ALTER TABLE public.bubble_memberships REPLICA IDENTITY FULL;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bubble_memberships;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    -- Enable realtime for meetup_rsvps
    ALTER TABLE public.meetup_rsvps REPLICA IDENTITY FULL;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meetup_rsvps;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;