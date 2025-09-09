-- Add some sample meetups for testing
INSERT INTO public.meetups (bubble_id, organizer_id, title, description, date_time, latitude, longitude, location_name, status) 
SELECT 
  b.id,
  (SELECT id FROM auth.users LIMIT 1),
  CASE 
    WHEN b.interest_tag = 'Technology' THEN 'Tech Meetup: AI & Future'
    WHEN b.interest_tag = 'Fitness' THEN 'Morning Group Run'
    WHEN b.interest_tag = 'Food' THEN 'Food Tasting Adventure'
    WHEN b.interest_tag = 'Music' THEN 'Live Music Session'
    WHEN b.interest_tag = 'Photography' THEN 'Golden Hour Photo Walk'
    ELSE CONCAT(b.interest_tag, ' Meetup')
  END,
  CASE 
    WHEN b.interest_tag = 'Technology' THEN 'Join us for an exciting discussion about AI and the future of technology. Bring your ideas!'
    WHEN b.interest_tag = 'Fitness' THEN 'Start your day with energy! Meet us for a refreshing group run around the neighborhood.'
    WHEN b.interest_tag = 'Food' THEN 'Explore new flavors and dishes together. Perfect for food enthusiasts!'
    WHEN b.interest_tag = 'Music' THEN 'Bring your instruments or just come to listen. All music lovers welcome!'
    WHEN b.interest_tag = 'Photography' THEN 'Capture the perfect golden hour shots. All skill levels welcome!'
    ELSE CONCAT('Come join fellow ', b.interest_tag, ' enthusiasts for a fun meetup!')
  END,
  CASE 
    WHEN EXTRACT(dow FROM CURRENT_DATE) < 5 THEN CURRENT_DATE + INTERVAL '2 days' + TIME '18:00'
    ELSE CURRENT_DATE + INTERVAL '3 days' + TIME '10:00'
  END,
  b.latitude + (RANDOM() - 0.5) * 0.01,
  b.longitude + (RANDOM() - 0.5) * 0.01,
  CASE 
    WHEN b.interest_tag = 'Technology' THEN 'Innovation Hub'
    WHEN b.interest_tag = 'Fitness' THEN 'Central Park'
    WHEN b.interest_tag = 'Food' THEN 'Downtown Food District'
    WHEN b.interest_tag = 'Music' THEN 'Community Center'
    WHEN b.interest_tag = 'Photography' THEN 'Golden Gate Park'
    ELSE 'Community Meeting Point'
  END,
  'upcoming'
FROM public.bubbles b
WHERE b.interest_tag IN ('Technology', 'Fitness', 'Food', 'Music', 'Photography')
LIMIT 10;