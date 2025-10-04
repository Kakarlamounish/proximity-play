-- Add ghost_mode column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN ghost_mode boolean DEFAULT false;