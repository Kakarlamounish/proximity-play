-- Add missing columns to bubbles table for enhanced functionality
ALTER TABLE public.bubbles 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- Add missing columns to bubble_memberships table
ALTER TABLE public.bubble_memberships 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member'));

-- Update bubble_memberships to use created_at instead of joined_at for consistency
ALTER TABLE public.bubble_memberships RENAME COLUMN joined_at TO created_at;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bubbles_creator ON public.bubbles(creator_id);
CREATE INDEX IF NOT EXISTS idx_bubbles_interest_tag ON public.bubbles(interest_tag);
CREATE INDEX IF NOT EXISTS idx_bubble_memberships_role ON public.bubble_memberships(role);

-- Add RLS policies for the new creator functionality
CREATE POLICY "Bubble creators can update their bubbles" 
ON public.bubbles 
FOR UPDATE 
USING (auth.uid() = creator_id);

CREATE POLICY "Bubble creators can delete their bubbles" 
ON public.bubbles 
FOR DELETE 
USING (auth.uid() = creator_id);

-- Update existing bubbles to have a creator (set to first user for demo)
UPDATE public.bubbles 
SET creator_id = (SELECT id FROM auth.users LIMIT 1)
WHERE creator_id IS NULL;