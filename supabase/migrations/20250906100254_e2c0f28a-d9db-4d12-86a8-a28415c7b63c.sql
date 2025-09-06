-- Create custom types (if not exists)
DO $$ BEGIN
    CREATE TYPE public.gender_type AS ENUM ('male', 'female', 'non_binary', 'prefer_not_to_say');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.meetup_status AS ENUM ('upcoming', 'ongoing', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.rsvp_status AS ENUM ('going', 'maybe', 'not_going');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.report_reason AS ENUM ('spam', 'harassment', 'inappropriate_content', 'fake_profile', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
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
CREATE TABLE IF NOT EXISTS public.bubbles (
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
CREATE TABLE IF NOT EXISTS public.bubble_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    bubble_id UUID REFERENCES public.bubbles(id) ON DELETE CASCADE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, bubble_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
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
CREATE TABLE IF NOT EXISTS public.meetups (
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
CREATE TABLE IF NOT EXISTS public.meetup_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meetup_id UUID REFERENCES public.meetups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status rsvp_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(meetup_id, user_id)
);

-- Create user_blocks table
CREATE TABLE IF NOT EXISTS public.user_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id),
    CHECK (blocker_id != blocked_id)
);

-- Create user_reports table
CREATE TABLE IF NOT EXISTS public.user_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    reported_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    reason report_reason NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (reporter_id != reported_id)
);

-- Create badges table
CREATE TABLE IF NOT EXISTS public.badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_badges table
CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
);

-- Insert default badges if they don't exist
INSERT INTO public.badges (name, description, icon) 
SELECT * FROM (VALUES
    ('Connector', 'Joined 5 different bubbles', '🔗'),
    ('Event Organizer', 'Organized 3 meetups', '📅'),
    ('Social Butterfly', 'Sent 100 messages', '🦋'),
    ('Explorer', 'Joined bubbles in 3 different locations', '🗺️')
) AS t(name, description, icon)
WHERE NOT EXISTS (SELECT 1 FROM public.badges WHERE badges.name = t.name);

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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all bubbles" ON public.bubbles;
DROP POLICY IF EXISTS "Only system can manage bubbles" ON public.bubbles;

-- RLS Policies for bubbles
CREATE POLICY "Users can view all bubbles" ON public.bubbles FOR SELECT USING (true);
CREATE POLICY "Only system can manage bubbles" ON public.bubbles FOR ALL USING (false);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view bubble memberships" ON public.bubble_memberships;
DROP POLICY IF EXISTS "Users can join bubbles" ON public.bubble_memberships;
DROP POLICY IF EXISTS "Users can leave their bubbles" ON public.bubble_memberships;

-- RLS Policies for bubble_memberships
CREATE POLICY "Users can view bubble memberships" ON public.bubble_memberships FOR SELECT USING (true);
CREATE POLICY "Users can join bubbles" ON public.bubble_memberships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave their bubbles" ON public.bubble_memberships FOR DELETE USING (auth.uid() = user_id);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view messages in their bubbles" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

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

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
SELECT 'profile-photos', 'profile-photos', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'profile-photos');

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Anyone can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile photos" ON storage.objects;

-- Create storage policies
CREATE POLICY "Anyone can view profile photos" ON storage.objects 
FOR SELECT USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can upload their own profile photos" ON storage.objects 
FOR INSERT WITH CHECK (
    bucket_id = 'profile-photos' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Enable realtime for messages
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;