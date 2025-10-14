-- Create story_views table to track who viewed each story
CREATE TABLE public.story_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.user_reports(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);

-- Enable RLS
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Users can view story views for their own stories
CREATE POLICY "Users can view their story views"
ON public.story_views
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_reports
    WHERE user_reports.id = story_views.story_id
    AND user_reports.reporter_id = auth.uid()
  )
);

-- Users can create story views
CREATE POLICY "Users can create story views"
ON public.story_views
FOR INSERT
WITH CHECK (auth.uid() = viewer_id);

-- Create story_reactions table
CREATE TABLE public.story_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.user_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(story_id, user_id)
);

-- Enable RLS
ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;

-- Users can view all story reactions
CREATE POLICY "Users can view story reactions"
ON public.story_reactions
FOR SELECT
USING (true);

-- Users can create their own reactions
CREATE POLICY "Users can create reactions"
ON public.story_reactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reactions
CREATE POLICY "Users can delete their reactions"
ON public.story_reactions
FOR DELETE
USING (auth.uid() = user_id);

-- Create story_comments table
CREATE TABLE public.story_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.user_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;

-- Users can view all comments
CREATE POLICY "Users can view story comments"
ON public.story_comments
FOR SELECT
USING (true);

-- Users can create comments
CREATE POLICY "Users can create comments"
ON public.story_comments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update their comments"
ON public.story_comments
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their comments"
ON public.story_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updating story_comments updated_at
CREATE TRIGGER update_story_comments_updated_at
BEFORE UPDATE ON public.story_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_story_views_story_id ON public.story_views(story_id);
CREATE INDEX idx_story_reactions_story_id ON public.story_reactions(story_id);
CREATE INDEX idx_story_comments_story_id ON public.story_comments(story_id);