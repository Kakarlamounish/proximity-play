-- Migration: Create ar_pins table for AR notes/pins
CREATE TABLE ar_pins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    note text NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE ar_pins ENABLE ROW LEVEL SECURITY;

-- Policy: Allow insert/select for authenticated users
CREATE POLICY "Allow insert/select for authenticated users" ON ar_pins
    FOR ALL
    USING (auth.uid() = user_id);
