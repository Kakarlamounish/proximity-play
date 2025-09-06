-- Create custom types
CREATE TYPE public.gender_type AS ENUM ('male', 'female', 'non_binary', 'prefer_not_to_say');
CREATE TYPE public.meetup_status AS ENUM ('upcoming', 'ongoing', 'completed', 'cancelled');
CREATE TYPE public.rsvp_status AS ENUM ('going', 'maybe', 'not_going');
CREATE TYPE public.report_reason AS ENUM ('spam', 'harassment', 'inappropriate_content', 'fake_profile', 'other');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 15),
    gender gender_type,
    bio TEXT CHECK (length(bio) <= 150),
    interests TEXT[] DEFAULT '{}',
    profile_photo_url TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bubbles table
CREATE TABLE public.bubbles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    interest_tag TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    member_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bubble_memberships table
CREATE TABLE public.bubble_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    bubble_id UUID REFERENCES public.bubbles(id) ON DELETE CASCADE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, bubble_id)
);

-- Create messages table
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    bubble_id UUID REFERENCES public.bubbles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (
        (bubble_id IS NOT NULL AND recipient_id IS NULL) OR 
        (bubble_id IS NULL AND recipient_id IS NOT NULL)
    )
);

-- Create meetups table
CREATE TABLE public.meetups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bubble_id UUID REFERENCES public.bubbles(id) ON DELETE CASCADE NOT NULL,
    organizer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    location_name TEXT,
    status meetup_status DEFAULT 'upcoming',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create meetup_rsvps table
CREATE TABLE public.meetup_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meetup_id UUID REFERENCES public.meetups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status rsvp_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(meetup_id, user_id)
);

-- Create user_blocks table
CREATE TABLE public.user_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id),
    CHECK (blocker_id != blocked_id)
);

-- Create user_reports table
CREATE TABLE public.user_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    reported_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    reason report_reason NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (reporter_id != reported_id)
);

-- Create badges table
CREATE TABLE public.badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_badges table
CREATE TABLE public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
);

-- Insert default badges
INSERT INTO public.badges (name, description, icon) VALUES
('Connector', 'Joined 5 different bubbles', '🔗'),
('Event Organizer', 'Organized 3 meetups', '📅'),
('Social Butterfly', 'Sent 100 messages', '🦋'),
('Explorer', 'Joined bubbles in 3 different locations', '🗺️');

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bubbles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bubble_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetup_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for bubbles
CREATE POLICY "Users can view all bubbles" ON public.bubbles FOR SELECT USING (true);
CREATE POLICY "Only system can manage bubbles" ON public.bubbles FOR ALL USING (false);

-- RLS Policies for bubble_memberships
CREATE POLICY "Users can view bubble memberships" ON public.bubble_memberships FOR SELECT USING (true);
CREATE POLICY "Users can join bubbles" ON public.bubble_memberships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave their bubbles" ON public.bubble_memberships FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their bubbles" ON public.messages 
FOR SELECT USING (
    (bubble_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.bubble_memberships 
        WHERE bubble_id = messages.bubble_id AND user_id = auth.uid()
    )) OR
    (recipient_id IS NOT NULL AND (sender_id = auth.uid() OR recipient_id = auth.uid()))
);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    (
        (bubble_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.bubble_memberships 
            WHERE bubble_id = messages.bubble_id AND user_id = auth.uid()
        )) OR
        (recipient_id IS NOT NULL AND recipient_id != auth.uid())
    )
);

-- RLS Policies for meetups
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

-- RLS Policies for meetup_rsvps
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

-- RLS Policies for user_blocks
CREATE POLICY "Users can view their blocks" ON public.user_blocks FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "Users can block others" ON public.user_blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users can unblock others" ON public.user_blocks FOR DELETE USING (auth.uid() = blocker_id);

-- RLS Policies for user_reports
CREATE POLICY "Users can view their reports" ON public.user_reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Users can report others" ON public.user_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- RLS Policies for badges
CREATE POLICY "Everyone can view badges" ON public.badges FOR SELECT USING (true);

-- RLS Policies for user_badges
CREATE POLICY "Users can view all user badges" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "Only system can award badges" ON public.user_badges FOR ALL USING (false);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true);

-- Create storage policies
CREATE POLICY "Anyone can view profile photos" ON storage.objects 
FOR SELECT USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can upload their own profile photos" ON storage.objects 
FOR INSERT WITH CHECK (
    bucket_id = 'profile-photos' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

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

-- Create triggers for updating timestamps
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bubbles_updated_at BEFORE UPDATE ON public.bubbles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meetups_updated_at BEFORE UPDATE ON public.meetups
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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

-- Create trigger to update bubble member count
CREATE TRIGGER update_bubble_member_count_trigger
    AFTER INSERT OR DELETE ON public.bubble_memberships
    FOR EACH ROW EXECUTE FUNCTION public.update_bubble_member_count();

-- Enable realtime for messages
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Enable realtime for bubble_memberships
ALTER TABLE public.bubble_memberships REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bubble_memberships;

-- Enable realtime for meetup_rsvps
ALTER TABLE public.meetup_rsvps REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetup_rsvps;