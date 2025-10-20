import React, { useState, useEffect, useRef } from 'react';
import { cacheManager } from '@/utils/cache';

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  blurDataURL?: string;
  width?: number;
  height?: number;
  quality?: number;
  priority?: boolean;
  onLoad?: () => void;
  onError?: (error: Event) => void;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  style?: React.CSSProperties;
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  className = '',
  placeholder,
  blurDataURL,
  width,
  height,
  quality = 75,
  priority = false,
  onLoad,
  onError,
  sizes,
  loading = 'lazy',
  objectFit = 'cover',
  style = {},
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>(placeholder || blurDataURL || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Optimize image URL with CDN
  const optimizedSrc = cacheManager.optimizeImageUrl(src, {
    width,
    height,
    quality,
    format: 'webp', // Prefer WebP for better compression
  });

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || loading === 'eager') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.1,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    observerRef.current = observer;

    return () => {
      observer.disconnect();
    };
  }, [priority, loading]);

  // Load image when in view
  useEffect(() => {
    if (!isInView || hasError) return;

    const img = new Image();

    // Set up event handlers
    img.onload = () => {
      setCurrentSrc(optimizedSrc);
      setIsLoaded(true);
      onLoad?.();
    };

    img.onerror = (error) => {
      // Fallback to original src if optimized version fails
      if (optimizedSrc !== src) {
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          setCurrentSrc(src);
          setIsLoaded(true);
          onLoad?.();
        };
        fallbackImg.onerror = (fallbackError) => {
          setHasError(true);
          onError?.(fallbackError as Event);
        };
        fallbackImg.src = src;
      } else {
        setHasError(true);
        onError?.(error as Event);
      }
    };

    // Start loading
    img.src = optimizedSrc;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [isInView, optimizedSrc, src, hasError, onLoad, onError]);

  // Generate srcSet for responsive images
  const generateSrcSet = () => {
    if (!width || !height) return undefined;

    const breakpoints = [480, 768, 1024, 1280, 1920];
    const srcSet = breakpoints
      .filter(bp => bp <= (width * 2)) // Don't generate larger than 2x the original
      .map(bp => {
        const scaledWidth = Math.min(bp, width);
        const scaledHeight = height * (scaledWidth / width);
        const optimizedUrl = cacheManager.optimizeImageUrl(src, {
          width: scaledWidth,
          height: Math.round(scaledHeight),
          quality,
          format: 'webp',
        });
        return `${optimizedUrl} ${scaledWidth}w`;
      })
      .join(', ');

    return srcSet || undefined;
  };

  const srcSet = generateSrcSet();

  return (
    <div
      ref={imgRef}
      className={`progressive-image ${className}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: blurDataURL ? 'transparent' : '#f3f4f6',
        ...style,
      }}
    >
      {/* Blur placeholder */}
      {blurDataURL && !isLoaded && (
        <img
          src={blurDataURL}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit,
            filter: 'blur(10px)',
            transform: 'scale(1.1)',
            opacity: 0.8,
          }}
          aria-hidden="true"
        />
      )}

      {/* Main image */}
      {isInView && (
        <img
          src={currentSrc}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          style={{
            width: '100%',
            height: '100%',
            objectFit,
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
          }}
          onLoad={() => {
            setIsLoaded(true);
            onLoad?.();
          }}
          onError={(error) => {
            setHasError(true);
            onError?.(error.nativeEvent);
          }}
        />
      )}

      {/* Loading skeleton */}
      {!isLoaded && !hasError && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'loading 1.5s infinite',
          }}
          aria-hidden="true"
        />
      )}

      {/* Error state */}
      {hasError && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f9fafb',
            color: '#6b7280',
            fontSize: '14px',
          }}
        >
          Failed to load image
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes loading {
            0% {
              background-position: 200% 0;
            }
            100% {
              background-position: -200% 0;
            }
          }
        `
      }} />
    </div>
  );
};

// Hook for preloading images
export const useImagePreloader = () => {
  const preloadImages = React.useCallback((srcs: string[]) => {
    srcs.forEach(src => {
      const img = new Image();
      img.src = cacheManager.optimizeImageUrl(src, { quality: 75, format: 'webp' });
    });
  }, []);

  return { preloadImages };
};

// Hook for image lazy loading with intersection observer
export const useLazyImage = (src: string, options?: { threshold?: number; rootMargin?: string }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        threshold: options?.threshold || 0.1,
        rootMargin: options?.rootMargin || '50px',
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [options?.threshold, options?.rootMargin]);

  useEffect(() => {
    if (!isInView) return;

    const img = new Image();
    img.onload = () => setIsLoaded(true);
    img.onerror = () => setHasError(true);
    img.src = cacheManager.optimizeImageUrl(src);

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [isInView, src]);

  return { imgRef, isLoaded, hasError, isInView };
};

// Image optimization utility
export const optimizeImage = (
  src: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'jpg' | 'png';
  } = {}
): string => {
  return cacheManager.optimizeImageUrl(src, options);
};

// WebP support detection
export const supportsWebP = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2);
    };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
};

// AVIF support detection
export const supportsAVIF = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const avif = new Image();
    avif.onload = avif.onerror = () => {
      resolve(avif.height === 2);
    };
    avif.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=';
  });
};