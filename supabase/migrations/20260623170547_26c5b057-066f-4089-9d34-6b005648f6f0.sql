
CREATE POLICY "voice_notes_read_auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'voice-notes');

CREATE POLICY "voice_notes_insert_own_folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "voice_notes_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
