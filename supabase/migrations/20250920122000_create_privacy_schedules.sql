-- Migration: Create privacy_schedules table for location sharing scheduling
CREATE TABLE privacy_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    start_time text NOT NULL,
    end_time text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE privacy_schedules ENABLE ROW LEVEL SECURITY;

-- Policy: Allow insert/select/update for authenticated users
CREATE POLICY "Allow insert/select/update for authenticated users" ON privacy_schedules
    FOR ALL
    USING (auth.uid() = user_id);
