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
  const [duration, setDuration] = useState<number>(24); // Hours
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);

      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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
    const expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();
    // @ts-ignore - location_stories table exists in database but not in generated types
    const { error: dbError } = await supabase.from('location_stories').insert({
      user_id: user.id,
      latitude: userLocation[0],
      longitude: userLocation[1],
      text_content: text,
      image_url: imageUrl,
      expires_at: expiresAt,
      visibility_radius: 500, // 500 meters radius
    } as any);
    if (dbError) {
      setError('Failed to post story');
    } else {
      setText('');
      setImage(null);
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onClose();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Story</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="What's happening at this location?"
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
            className="resize-none"
          />

          <div className="space-y-2">
            <label className="text-sm font-medium">Add Photo (Optional)</label>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="cursor-pointer"
            />
            {previewUrl && (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-32 object-cover rounded-lg border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    setImage(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                >
                  ✕
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Story Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-input rounded-md"
            >
              <option value={1}>1 hour</option>
              <option value={6}>6 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>24 hours</option>
              <option value={48}>48 hours</option>
            </select>
          </div>

          {userLocation && (
            <div className="text-sm text-muted-foreground">
              📍 Location: {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
            </div>
          )}

          {error && <div className="text-red-500 text-sm">{error}</div>}

          <Button
            type="submit"
            disabled={loading || !userLocation || (!text.trim() && !image)}
            className="w-full bg-gradient-to-r from-secondary to-primary"
          >
            {loading ? 'Creating Story...' : 'Share Story'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateStoryDialog;
