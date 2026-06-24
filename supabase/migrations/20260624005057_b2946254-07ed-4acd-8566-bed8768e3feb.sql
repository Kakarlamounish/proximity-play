
-- 1. Notifications: remove broad authenticated INSERT
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

-- 2. Profile location column-level restriction
REVOKE SELECT (latitude, longitude) ON public.profiles FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_friend_locations()
RETURNS TABLE (
  id uuid,
  first_name text,
  profile_photo_url text,
  latitude double precision,
  longitude double precision,
  ghost_mode boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.profile_photo_url, p.latitude, p.longitude, p.ghost_mode
  FROM public.profiles p
  WHERE p.ghost_mode = false
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND (
      p.id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE (f.user_id_1 = auth.uid() AND f.user_id_2 = p.id)
           OR (f.user_id_2 = auth.uid() AND f.user_id_1 = p.id)
      )
    );
$$;
REVOKE EXECUTE ON FUNCTION public.get_friend_locations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_friend_locations() TO authenticated;

-- 3. Storage: remove broad listing on public buckets (public URL still works)
DROP POLICY IF EXISTS "Anyone can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view story images" ON storage.objects;

-- 4. Revoke execute on trigger helper functions from public/anon/authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_friend_request_accepted() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_bubble_member_count() FROM PUBLIC, anon, authenticated;
