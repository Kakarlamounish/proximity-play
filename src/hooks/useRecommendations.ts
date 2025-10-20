import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { recommendationEngine, type RecommendationResult } from '@/utils/recommendationEngine';
import { supabase } from '@/integrations/supabase/client';

interface UseRecommendationsOptions {
  enabled?: boolean;
  limit?: number;
  refreshInterval?: number;
}

export const useRecommendations = (options: UseRecommendationsOptions = {}) => {
  const {
    enabled = true,
    limit = 10,
    refreshInterval = 5 * 60 * 1000, // 5 minutes
  } = options;

  const { user, userLocation } = useAppStore();
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchRecommendations = useCallback(async () => {
    if (!enabled || !user) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch user's profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('interests, bio, age')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Fetch available bubbles
      const { data: bubbles, error: bubblesError } = await supabase
        .from('bubbles')
        .select('id, name, description, interest_tag, member_count, latitude, longitude')
        .limit(100); // Limit for performance

      if (bubblesError) throw bubblesError;

      // Get user profile for recommendations
      const userProfile = {
        id: user.id,
        interests: profile.interests || [],
        bio: profile.bio || '',
        age: profile.age,
        location: userLocation ? {
          latitude: userLocation.lat,
          longitude: userLocation.lng,
        } : undefined,
      } as any;

      // Transform location to match expected format
      const transformedLocation = userLocation ? {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
      } : undefined;

      // Generate recommendations
      const recs = await recommendationEngine.recommendBubbles(
        userProfile,
        bubbles || [],
        transformedLocation,
        limit
      );

      setRecommendations(recs);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch recommendations');
    } finally {
      setIsLoading(false);
    }
  }, [enabled, user, userLocation, limit]);

  // Initial fetch
  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Periodic refresh
  useEffect(() => {
    if (!enabled || refreshInterval <= 0) return;

    const interval = setInterval(fetchRecommendations, refreshInterval);
    return () => clearInterval(interval);
  }, [enabled, refreshInterval, fetchRecommendations]);

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return {
    recommendations,
    isLoading,
    error,
    lastUpdated,
    refresh,
  };
};

export const useContentAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeContent = useCallback(async (content: string) => {
    setIsAnalyzing(true);
    try {
      const analysis = await recommendationEngine.analyzeContent(content);
      return analysis;
    } catch (error) {
      console.error('Error analyzing content:', error);
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return {
    analyzeContent,
    isAnalyzing,
  };
};

export const useContentSuggestions = () => {
  const { user, userLocation } = useAppStore();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const generateSuggestions = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const userProfile = {
        id: user.id,
        interests: [], // Would need to fetch from profile
        bio: '',
        location: userLocation ? {
          latitude: userLocation.lat,
          longitude: userLocation.lng,
        } : undefined,
      };

      const suggs = await recommendationEngine.generateContentSuggestions(userProfile);
      setSuggestions(suggs);
    } catch (error) {
      console.error('Error generating suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, userLocation]);

  useEffect(() => {
    generateSuggestions();
  }, [generateSuggestions]);

  return {
    suggestions,
    isLoading,
    regenerate: generateSuggestions,
  };
};

export const useSimilarUsers = (targetUserId?: string) => {
  const { user } = useAppStore();
  const [similarUsers, setSimilarUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const findSimilarUsers = useCallback(async () => {
    const userId = targetUserId || user?.id;
    if (!userId) return;

    setIsLoading(true);
    try {
      // Fetch target user profile
      const { data: targetProfile, error: targetError } = await supabase
        .from('profiles')
        .select('id, interests, bio, age')
        .eq('id', userId)
        .single();

      if (targetError) throw targetError;

      // Fetch other users (limited for performance)
      const { data: otherUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id, interests, bio, age')
        .neq('id', userId)
        .limit(50);

      if (usersError) throw usersError;

      const targetUser = {
        id: targetProfile.id,
        interests: targetProfile.interests || [],
        bio: targetProfile.bio || '',
        age: targetProfile.age,
      };

      const similar = await recommendationEngine.findSimilarUsers(
        targetUser,
        otherUsers || [],
        5
      );

      setSimilarUsers(similar);
    } catch (error) {
      console.error('Error finding similar users:', error);
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId, user?.id]);

  useEffect(() => {
    findSimilarUsers();
  }, [findSimilarUsers]);

  return {
    similarUsers,
    isLoading,
    refresh: findSimilarUsers,
  };
};