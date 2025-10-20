import { useState, useEffect, useCallback } from 'react';
import { cacheManager, supabaseCache, CACHE_CONFIG } from '@/utils/cache';

interface UseCacheOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  ttl?: number;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export const useCache = <T>({
  key,
  fetcher,
  ttl = CACHE_CONFIG.MEDIUM,
  enabled = true,
  onSuccess,
  onError,
}: UseCacheOptions<T>) => {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);

  const fetchData = useCallback(async (force = false) => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      // Try to get from cache first
      if (!force) {
        const cachedData = await cacheManager.get<T>(key);
        if (cachedData !== null) {
          setData(cachedData);
          setIsStale(false);
          onSuccess?.(cachedData);
          setIsLoading(false);
          return;
        }
      }

      // Fetch fresh data
      const freshData = await fetcher();

      // Cache the data
      await cacheManager.set(key, freshData, { ttl });

      setData(freshData);
      setIsStale(false);
      onSuccess?.(freshData);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [key, fetcher, ttl, enabled, onSuccess, onError]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch function
  const refetch = useCallback(() => fetchData(true), [fetchData]);

  // Invalidate cache
  const invalidate = useCallback(async () => {
    await cacheManager.delete(key);
    setIsStale(true);
  }, [key]);

  return {
    data,
    isLoading,
    error,
    isStale,
    refetch,
    invalidate,
  };
};

export const useSupabaseCache = <T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  cacheKey: string,
  options: {
    ttl?: number;
    enabled?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  } = {}
) => {
  const { ttl = CACHE_CONFIG.MEDIUM, enabled = true, onSuccess, onError } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const fetchData = useCallback(async (force = false) => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await supabaseCache.query(
        queryFn,
        cacheKey,
        { ttl, force }
      );

      if (result.error) {
        throw result.error;
      }

      if (result.data) {
        setData(result.data);
        onSuccess?.(result.data);
      }
    } catch (err) {
      setError(err);
      onError?.(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [queryFn, cacheKey, ttl, enabled, onSuccess, onError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  const invalidate = useCallback(async () => {
    await supabaseCache.invalidate(cacheKey);
  }, [cacheKey]);

  return {
    data,
    isLoading,
    error,
    refetch,
    invalidate,
  };
};

// Hook for image optimization
export const useOptimizedImage = (
  originalUrl: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'jpg' | 'png';
  } = {}
) => {
  const [optimizedUrl, setOptimizedUrl] = useState(originalUrl);

  useEffect(() => {
    const url = cacheManager.optimizeImageUrl(originalUrl, options);
    setOptimizedUrl(url);
  }, [originalUrl, options.width, options.height, options.quality, options.format]);

  return optimizedUrl;
};

// Hook for cache statistics
export const useCacheStats = () => {
  const [stats, setStats] = useState(cacheManager.getStats());

  const refreshStats = useCallback(() => {
    setStats(cacheManager.getStats());
  }, []);

  const clearCache = useCallback(async () => {
    await cacheManager.clear();
    refreshStats();
  }, [refreshStats]);

  return {
    stats,
    refreshStats,
    clearCache,
  };
};

// Hook for HTTP caching
export const useHTTPCache = () => {
  const fetchWithCache = useCallback(
    (url: string, options?: RequestInit, ttl?: number) => {
      return cacheManager.fetchWithCache(url, options, ttl);
    },
    []
  );

  return { fetchWithCache };
};