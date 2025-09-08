import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ImageUpload } from '@/components/ImageUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X } from 'lucide-react';

const INTEREST_OPTIONS = [
  'Sports', 'Music', 'Art', 'Technology', 'Travel', 'Food', 'Books', 'Movies',
  'Gaming', 'Fitness', 'Photography', 'Cooking', 'Dancing', 'Hiking', 'Yoga',
  'Business', 'Science', 'Fashion', 'Nature', 'Volunteering'
];

const ProfileSetup = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [firstName, setFirstName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect unauthenticated users
  if (!user && !loading) {
    return <Navigate to="/auth" replace />;
  }

  const addInterest = (interest: string) => {
    if (!interests.includes(interest) && interests.length < 10) {
      setInterests([...interests, interest]);
    }
  };

  const removeInterest = (interest: string) => {
    setInterests(interests.filter(i => i !== interest));
  };

  const addCustomInterest = () => {
    if (customInterest.trim() && !interests.includes(customInterest.trim()) && interests.length < 10) {
      setInterests([...interests, customInterest.trim()]);
      setCustomInterest('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (parseInt(age) < 15) {
      toast({
        title: "Age requirement",
        description: "You must be at least 15 years old to use Social Bubble.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
        const { error } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            first_name: firstName,
            age: parseInt(age),
            gender: gender as "male" | "female" | "non_binary" | "prefer_not_to_say" | null,
            bio: bio || null,
            interests,
            profile_photo_url: profilePhotoUrl || null,
          });

      if (error) {
        throw error;
      }

      toast({
        title: "Profile created!",
        description: "Welcome to Social Bubble. Let's find your bubbles!",
      });

      navigate('/');
    } catch (error: any) {
      toast({
        title: "Profile creation failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-primary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-primary p-4">
      <div className="max-w-2xl mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
            Complete Your Profile
          </h1>
          <p className="text-muted-foreground mt-2">Tell us about yourself to find your perfect bubbles</p>
        </div>

        <Card className="backdrop-blur-sm bg-card/95 shadow-2xl border-0">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>This information helps us connect you with like-minded people nearby</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Profile Photo */}
              <div className="flex justify-center">
                <ImageUpload
                  currentImageUrl={profilePhotoUrl}
                  onImageUploaded={setProfilePhotoUrl}
                  userName={firstName}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name / Nickname *</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="How should people call you?"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="age">Age *</Label>
                  <Input
                    id="age"
                    type="number"
                    placeholder="Your age"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    min="15"
                    max="120"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Gender (Optional)</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your gender" />
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
                <Label htmlFor="bio">Bio (Optional)</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us a bit about yourself... (max 150 characters)"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={150}
                  className="resize-none"
                />
                <p className="text-sm text-muted-foreground">{bio.length}/150 characters</p>
              </div>

              <div className="space-y-4">
                <Label>Interests (Select up to 10)</Label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((interest) => (
                    <Button
                      key={interest}
                      type="button"
                      variant={interests.includes(interest) ? "default" : "outline"}
                      size="sm"
                      onClick={() => 
                        interests.includes(interest) 
                          ? removeInterest(interest)
                          : addInterest(interest)
                      }
                      disabled={!interests.includes(interest) && interests.length >= 10}
                      className={
                        interests.includes(interest) 
                          ? "bg-gradient-to-r from-secondary to-primary hover:from-secondary-dark hover:to-primary-dark" 
                          : ""
                      }
                    >
                      {interest}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Add custom interest"
                    value={customInterest}
                    onChange={(e) => setCustomInterest(e.target.value)}
                    maxLength={20}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addCustomInterest}
                    disabled={!customInterest.trim() || interests.length >= 10}
                  >
                    Add
                  </Button>
                </div>

                {interests.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Selected interests:</p>
                    <div className="flex flex-wrap gap-2">
                      {interests.map((interest) => (
                        <Badge key={interest} variant="secondary" className="flex items-center gap-1">
                          {interest}
                          <X 
                            className="h-3 w-3 cursor-pointer" 
                            onClick={() => removeInterest(interest)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-secondary to-primary hover:from-secondary-dark hover:to-primary-dark"
                disabled={isLoading || !firstName || !age || parseInt(age) < 15}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating profile...
                  </>
                ) : (
                  'Complete Profile'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfileSetup;