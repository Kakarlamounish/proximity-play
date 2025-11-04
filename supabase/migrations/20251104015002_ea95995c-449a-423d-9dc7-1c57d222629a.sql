-- Create stories storage bucket for location stories with images
INSERT INTO storage.buckets (id, name, public)
VALUES ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for stories bucket
CREATE POLICY "Users can upload their own story images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'stories' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view story images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'stories');

CREATE POLICY "Users can update their own story images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'stories' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own story images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'stories' AND
  auth.uid()::text = (storage.foldername(name))[1]
);