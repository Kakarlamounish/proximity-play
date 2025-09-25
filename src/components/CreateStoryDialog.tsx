import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface CreateStoryDialogProps {
  open: boolean;
  onClose: () => void;
  userLocation: [number, number] | null;
}

const DEFAULT_EXPIRY_HOURS = 24;

const CreateStoryDialog: React.FC<CreateStoryDialogProps> = ({ open, onClose, userLocation }) => {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filters, setFilters] = useState<string>('none');
  const [duration, setDuration] = useState<number>(24); // Hours
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userLocation) {
      setError('Location or user missing');
      return;
    }
    setLoading(true);
    setError(null);
    let imageUrl = '';
    if (image) {
      const fileExt = image.name.split('.').pop();
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('stories')
        .upload(fileName, image);
      
      if (uploadError) {
        setError('Image upload failed');
        setLoading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('stories')
        .getPublicUrl(fileName);
        
      imageUrl = urlData.publicUrl;
    }
    const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
    // @ts-ignore - table exists in database
    const { error: dbError } = await supabase.from('location_stories').insert({
      user_id: user.id,
      latitude: userLocation[0],
      longitude: userLocation[1],
      text_content: text,
      image_url: imageUrl,
      expires_at: expiresAt,
      visibility_radius: 500,
    });
    if (dbError) {
      setError('Failed to post story');
    } else {
      setText('');
      setImage(null);
      onClose();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogHeader>
        <DialogTitle>Post a Story</DialogTitle>
      </DialogHeader>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="What's happening?"
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
          />
          <Input type="file" accept="image/*" onChange={handleImageChange} />
          {error && <div className="text-red-500 text-sm">{error}</div>}
          <Button type="submit" disabled={loading || !userLocation}>
            {loading ? 'Posting...' : 'Post Story'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateStoryDialog;
