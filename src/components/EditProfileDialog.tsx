import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit2, Plus, X, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ImageUpload } from './ImageUpload';
import type { Database } from '@/integrations/supabase/types';

type ProfilesRow = Database['public']['Tables']['profiles']['Row'];

interface EditProfileDialogProps {
  profile: ProfilesRow;
  onProfileUpdate: (updatedProfile: ProfilesRow) => void;
}

const INTERESTS_OPTIONS = [
  'Technology', 'Sports', 'Music', 'Art', 'Travel', 'Food', 'Books', 'Movies',
  'Photography', 'Gaming', 'Fitness', 'Cooking', 'Dancing', 'Hiking', 'Science',
  'Business', 'Fashion', 'Health', 'Education', 'Volunteering', 'Yoga', 'Writing'
];

export const EditProfileDialog: React.FC<EditProfileDialogProps> = ({ profile, onProfileUpdate }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<{
    first_name: string;
    bio: string;
    age: number;
    gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | '';
    interests: string[];
    profile_photo_url: string;
  }>({
    first_name: profile?.first_name || '',
    bio: profile?.bio || '',
    age: profile?.age || 18,
    gender: profile?.gender || '',
    interests: profile?.interests || [],
    profile_photo_url: profile?.profile_photo_url || ''
  });
  const [newInterest, setNewInterest] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateData: any = {
        first_name: formData.first_name,
        bio: formData.bio,
        age: formData.age,
        interests: formData.interests,
        profile_photo_url: formData.profile_photo_url,
        updated_at: new Date().toISOString()
      };

      if (formData.gender) {
        updateData.gender = formData.gender;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id)
        .select()
        .single();

      if (error) throw error;

      onProfileUpdate(data);
      setOpen(false);
      
      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
      });
    } catch (error: any) {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addInterest = (interest: string) => {
    if (interest && !formData.interests.includes(interest)) {
      setFormData(prev => ({
        ...prev,
        interests: [...prev.interests, interest]
      }));
      setNewInterest('');
    }
  };

  const removeInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.filter(i => i !== interest)
    }));
  };

  const handlePhotoUpload = (photoUrl: string) => {
    setFormData(prev => ({
      ...prev,
      profile_photo_url: photoUrl
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-secondary to-primary hover:from-secondary-dark hover:to-primary-dark">
          <Edit2 className="h-4 w-4 mr-2" />
          Edit Profile
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Photo */}
            <div className="flex flex-col items-center gap-4">
              <ImageUpload
                currentImageUrl={formData.profile_photo_url}
                onImageUploaded={handlePhotoUpload}
                userName={formData.first_name}
                className="flex flex-col items-center"
              />
              <Button
                type="button"
                variant="outline"
                className="mt-2"
                onClick={async () => {
                  // Start Supabase OAuth sign-in with Google
                  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
                  if (error) {
                    toast({ title: 'Google import failed', description: error.message, variant: 'destructive' });
                  } else {
                    toast({ title: 'Google sign-in', description: 'Complete sign-in and your Google profile photo will be imported.' });
                  }
                }}
              >
                Import from Google
              </Button>
              <div className="mt-2 text-xs text-muted-foreground text-center">
                You can update your profile photo or import from Google.
              </div>
            </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                min="13"
                max="120"
                value={formData.age}
                onChange={(e) => setFormData(prev => ({ ...prev, age: parseInt(e.target.value) }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select 
              value={formData.gender} 
              onValueChange={(value: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say') => setFormData(prev => ({ ...prev, gender: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="non_binary">Non-binary</SelectItem>
                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell us about yourself..."
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Interests */}
          <div className="space-y-3">
            <Label>Interests</Label>
            
            <div className="flex gap-2">
              <Select value={newInterest} onValueChange={setNewInterest}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Add an interest" />
                </SelectTrigger>
                <SelectContent>
                  {INTERESTS_OPTIONS
                    .filter(interest => !formData.interests.includes(interest))
                    .map((interest) => (
                      <SelectItem key={interest} value={interest}>
                        {interest}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={() => addInterest(newInterest)}
                disabled={!newInterest || formData.interests.includes(newInterest)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {formData.interests.map((interest) => (
                <Badge key={interest} variant="secondary" className="flex items-center gap-1">
                  {interest}
                  <button
                    type="button"
                    onClick={() => removeInterest(interest)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Updating...' : 'Update Profile'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};