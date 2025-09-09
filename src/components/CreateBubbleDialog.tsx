import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from '@/hooks/useLocation';

const INTEREST_OPTIONS = [
  'Technology', 'Fitness', 'Food', 'Music', 'Photography', 'Art', 'Books', 
  'Movies', 'Gaming', 'Sports', 'Travel', 'Nature', 'Fashion', 'Business',
  'Education', 'Health', 'Pets', 'Crafts', 'Dancing', 'Cooking'
];

interface CreateBubbleDialogProps {
  onBubbleCreated?: () => void;
}

export const CreateBubbleDialog: React.FC<CreateBubbleDialogProps> = ({ onBubbleCreated }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { latitude, longitude } = useLocation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    interest_tag: '',
    privacy: 'public' as 'public' | 'private',
    custom_interests: [] as string[],
    custom_interest_input: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !latitude || !longitude) {
      toast({
        title: 'Error',
        description: 'Location is required to create a bubble',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { data: bubble, error } = await supabase
        .from('bubbles')
        .insert({
          name: formData.name,
          description: formData.description,
          interest_tag: formData.interest_tag,
          latitude,
          longitude,
          creator_id: user.id,
          is_private: formData.privacy === 'private',
          member_count: 1
        })
        .select()
        .single();

      if (error) throw error;

      // Automatically join the creator to the bubble
      await supabase
        .from('bubble_memberships')
        .insert({
          user_id: user.id,
          bubble_id: bubble.id,
          role: 'admin'
        });

      toast({
        title: 'Bubble created!',
        description: `${formData.name} has been created successfully`,
      });

      setOpen(false);
      setFormData({
        name: '',
        description: '',
        interest_tag: '',
        privacy: 'public',
        custom_interests: [],
        custom_interest_input: ''
      });
      
      onBubbleCreated?.();
    } catch (error: any) {
      toast({
        title: 'Error creating bubble',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const addCustomInterest = () => {
    if (formData.custom_interest_input.trim() && 
        !formData.custom_interests.includes(formData.custom_interest_input.trim())) {
      setFormData(prev => ({
        ...prev,
        custom_interests: [...prev.custom_interests, prev.custom_interest_input.trim()],
        custom_interest_input: ''
      }));
    }
  };

  const removeCustomInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      custom_interests: prev.custom_interests.filter(i => i !== interest)
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-secondary to-primary">
          <Plus className="h-4 w-4 mr-2" />
          Create Bubble
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Bubble</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Bubble Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Tech Enthusiasts NYC"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What's this bubble about?"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interest">Main Interest *</Label>
            <Select
              value={formData.interest_tag}
              onValueChange={(value) => setFormData(prev => ({ ...prev, interest_tag: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose primary interest" />
              </SelectTrigger>
              <SelectContent>
                {INTEREST_OPTIONS.map(interest => (
                  <SelectItem key={interest} value={interest}>
                    {interest}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Additional Tags</Label>
            <div className="flex gap-2">
              <Input
                value={formData.custom_interest_input}
                onChange={(e) => setFormData(prev => ({ ...prev, custom_interest_input: e.target.value }))}
                placeholder="Add custom tag"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomInterest())}
              />
              <Button type="button" onClick={addCustomInterest} variant="outline" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {formData.custom_interests.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {formData.custom_interests.map(interest => (
                  <Badge key={interest} variant="secondary" className="cursor-pointer">
                    {interest}
                    <X 
                      className="h-3 w-3 ml-1" 
                      onClick={() => removeCustomInterest(interest)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Privacy</Label>
            <Select
              value={formData.privacy}
              onValueChange={(value: 'public' | 'private') => setFormData(prev => ({ ...prev, privacy: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public - Anyone can join</SelectItem>
                <SelectItem value="private">Private - Invite only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !formData.name || !formData.interest_tag}
              className="bg-gradient-to-r from-secondary to-primary"
            >
              {loading ? 'Creating...' : 'Create Bubble'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};