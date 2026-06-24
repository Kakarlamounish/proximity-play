
DROP POLICY IF EXISTS dead_drops_select_auth ON public.dead_drops;
DROP POLICY IF EXISTS dead_drops_select_own ON public.dead_drops;
CREATE POLICY dead_drops_select_own ON public.dead_drops
  FOR SELECT TO authenticated
  USING (auth.uid() = created_by);

CREATE OR REPLACE FUNCTION public.get_nearby_dead_drops(
  user_lat double precision,
  user_lng double precision
)
RETURNS SETOF public.dead_drops
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.dead_drops d
  WHERE (d.expires_at IS NULL OR d.expires_at > now())
    AND (
      6371000 * 2 * asin(sqrt(
        power(sin(radians((user_lat - d.latitude)/2)), 2) +
        cos(radians(d.latitude)) * cos(radians(user_lat)) *
        power(sin(radians((user_lng - d.longitude)/2)), 2)
      )) <= d.radius
    );
$$;
REVOKE EXECUTE ON FUNCTION public.get_nearby_dead_drops(double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_nearby_dead_drops(double precision, double precision) TO authenticated;

DROP POLICY IF EXISTS "Service can read all subscriptions for sending" ON public.push_subscriptions;

DROP POLICY IF EXISTS voice_messages_select_auth ON public.voice_messages;
DROP POLICY IF EXISTS voice_messages_select_participants ON public.voice_messages;
CREATE POLICY voice_messages_select_sender ON public.voice_messages
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can view nearby stories" ON public.location_stories;
DROP POLICY IF EXISTS location_stories_select_auth ON public.location_stories;
CREATE POLICY location_stories_select_auth ON public.location_stories
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can view their story views" ON public.story_views;
DROP POLICY IF EXISTS story_views_select_owner ON public.story_views;
CREATE POLICY story_views_select_owner ON public.story_views
  FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.location_stories ls
      WHERE ls.id = story_views.story_id
        AND ls.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS activities_insert_own ON public.activities;
CREATE POLICY activities_insert_own ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
