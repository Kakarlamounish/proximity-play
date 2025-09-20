-- Migration: Create badges and user_badges tables for location-based rewards
CREATE TABLE badges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    icon text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_badges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    badge_id uuid REFERENCES badges(id) ON DELETE CASCADE,
    earned_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Policy: Allow select/insert for authenticated users
CREATE POLICY "Allow select/insert for authenticated users" ON badges
    FOR ALL
    USING (true);
CREATE POLICY "Allow select/insert for authenticated users" ON user_badges
    FOR ALL
    USING (auth.uid() = user_id);
