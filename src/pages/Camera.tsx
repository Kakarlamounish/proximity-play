import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { CameraScreen } from '@/components/CameraScreen';
import { useToast } from '@/hooks/use-toast';
import { useSnapScore } from '@/hooks/useSnapScore';

const CameraPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { incrementScore } = useSnapScore();

  if (!user && !loading) {
    return <Navigate to="/auth" replace />;
  }

  const handleCapture = (imageDataUrl: string) => {
    // In a full implementation, this would upload the snap and let you send to friends
    incrementScore('snaps_sent');
    toast({
      title: '📸 Snap captured!',
      description: 'Send to friends or add to your Story.',
    });
    navigate('/messages');
  };

  return (
    <CameraScreen
      onCapture={handleCapture}
      onClose={() => navigate(-1)}
    />
  );
};

export default CameraPage;
