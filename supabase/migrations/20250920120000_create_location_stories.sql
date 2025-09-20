-- Migration: Create location_stories table for map-based stories
CREATE TABLE IF NOT EXISTS public.location_stories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    text_content text,
    image_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    visibility_radius integer NOT NULL DEFAULT 500 -- meters
);

-- Index for fast geo queries
CREATE INDEX IF NOT EXISTS location_stories_geo_idx ON public.location_stories USING gist (ll_to_earth(latitude, longitude));

-- Only allow story owner to delete
CREATE POLICY "Delete own story" ON public.location_stories
    FOR DELETE USING (auth.uid() = user_id);

-- Only allow story owner to insert
CREATE POLICY "Insert own story" ON public.location_stories
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Anyone can select stories within their radius
CREATE POLICY "Select visible stories" ON public.location_stories
    FOR SELECT USING (true);

ALTER TABLE public.location_stories ENABLE ROW LEVEL SECURITY;
