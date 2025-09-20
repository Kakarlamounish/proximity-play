-- Migration: Create emergency_shares table for emergency location sharing
CREATE TABLE emergency_shares (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    shared_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE emergency_shares ENABLE ROW LEVEL SECURITY;

-- Policy: Allow insert/select for authenticated users
CREATE POLICY "Allow insert/select for authenticated users" ON emergency_shares
    FOR ALL
    USING (auth.uid() = user_id);
