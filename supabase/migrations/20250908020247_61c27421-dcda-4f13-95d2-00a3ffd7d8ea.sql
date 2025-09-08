-- Insert sample bubbles for testing
INSERT INTO public.bubbles (name, interest_tag, latitude, longitude, member_count) VALUES
-- Tech bubbles
('Tech Innovators Hub', 'Technology', 37.7749, -122.4194, 15),
('Startup Founders Circle', 'Business', 37.7849, -122.4094, 8),
('React Developers', 'Technology', 37.7649, -122.4294, 12),

-- Fitness bubbles
('Morning Runners', 'Fitness', 37.7849, -122.4174, 23),
('Yoga in the Park', 'Yoga', 37.7749, -122.4084, 18),
('Crossfit Warriors', 'Fitness', 37.7649, -122.4194, 11),

-- Food & Culture
('Food Explorers', 'Food', 37.7849, -122.4194, 29),
('Coffee Connoisseurs', 'Food', 37.7749, -122.4144, 16),
('Book Club Readers', 'Books', 37.7749, -122.4244, 14),
('Photography Walks', 'Photography', 37.7849, -122.4244, 20),

-- Arts & Music
('Indie Music Lovers', 'Music', 37.7649, -122.4144, 22),
('Digital Artists', 'Art', 37.7749, -122.4194, 13),
('Jazz Enthusiasts', 'Music', 37.7849, -122.4144, 17),

-- Outdoor & Adventure
('Hiking Adventures', 'Hiking', 37.7649, -122.4094, 31),
('Beach Volleyball', 'Sports', 37.7749, -122.4044, 19),
('Nature Photography', 'Photography', 37.7849, -122.4094, 9),

-- Learning & Growth
('Language Exchange', 'Travel', 37.7749, -122.4294, 25),
('Mindfulness Circle', 'Yoga', 37.7649, -122.4244, 14),
('Board Game Night', 'Gaming', 37.7849, -122.4174, 16),
('Cooking Classes', 'Cooking', 37.7749, -122.4124, 21);

-- Create trigger to automatically create profile after user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- This trigger will be called after a user is created in auth.users
  -- The profile will be created manually by the user through the profile setup page
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();