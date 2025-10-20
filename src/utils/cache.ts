import { supabase } from '@/integrations/supabase/client';

// Cache configuration
export const CACHE_CONFIG = {
  // Cache durations in milliseconds
  SHORT: 5 * 60 * 1000,      // 5 minutes
  MEDIUM: 30 * 60 * 1000,    // 30 minutes
  LONG: 2 * 60 * 60 * 1000,  // 2 hours
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 hours

  // Cache keys
  USER_PROFILE: 'user_profile',
  USER_BUBBLES: 'user_bubbles',
  BUBBLE_DETAILS: 'bubble_details',
  FRIENDS_LIST: 'friends_list',
  MESSAGES: 'messages',
  NOTIFICATIONS: 'notifications',
  RECOMMENDATIONS: 'recommendations',
  LOCATION_DATA: 'location_data',
  STORIES: 'stories',
  BADGES: 'badges',
};

// In-memory cache with TTL
class MemoryCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  set(key: string, data: any, ttl: number = CACHE_CONFIG.MEDIUM): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// IndexedDB cache for larger data
class IndexedDBCache {
  private dbName = 'ProximityPlayCache';
  private version = 1;

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async set(key: string, data: any, ttl: number = CACHE_CONFIG.LONG): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');

    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        key,
        data,
        timestamp: Date.now(),
        ttl,
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
  }

  async get<T>(key: string): Promise<T | null> {
    const db = await this.openDB();
    const transaction = db.transaction(['cache'], 'readonly');
    const store = transaction.objectStore('cache');

    return new Promise<T | null>((resolve, reject) => {
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        if (Date.now() - result.timestamp > result.ttl) {
          // Expired, delete it
          const deleteTransaction = db.transaction(['cache'], 'readwrite');
          const deleteStore = deleteTransaction.objectStore('cache');
          deleteStore.delete(key);
          resolve(null);
        } else {
          resolve(result.data as T);
        }
      };

      request.onerror = () => reject(request.error);
    }).finally(() => db.close());
  }

  async delete(key: string): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
  }

  async clear(): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');

    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
  }
}

// HTTP cache with ETags and Last-Modified
class HTTPCache {
  private cache = new Map<string, {
    data: any;
    etag?: string;
    lastModified?: string;
    timestamp: number;
    ttl: number;
  }>();

  async fetchWithCache(
    url: string,
    options: RequestInit = {},
    ttl: number = CACHE_CONFIG.MEDIUM
  ): Promise<Response> {
    const cacheKey = `${options.method || 'GET'}_${url}`;

    // Check memory cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      // Return cached response
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
        },
      });
    }

    // Add cache headers to request
    const headers = new Headers(options.headers);
    if (cached?.etag) {
      headers.set('If-None-Match', cached.etag);
    }
    if (cached?.lastModified) {
      headers.set('If-Modified-Since', cached.lastModified);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 304 Not Modified
    if (response.status === 304 && cached) {
      cached.timestamp = Date.now(); // Update timestamp
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
        },
      });
    }

    // Cache successful responses
    if (response.ok) {
      const data = await response.clone().json();
      const etag = response.headers.get('etag');
      const lastModified = response.headers.get('last-modified');

      this.cache.set(cacheKey, {
        data,
        etag,
        lastModified,
        timestamp: Date.now(),
        ttl,
      });
    }

    return response;
  }

  invalidate(url: string, method: string = 'GET'): void {
    const cacheKey = `${method}_${url}`;
    this.cache.delete(cacheKey);
  }

  clear(): void {
    this.cache.clear();
  }
}

// CDN optimization utilities
export class CDNOptimizer {
  private static instance: CDNOptimizer;
  private cdnUrl = 'https://cdn.proximity-play.com';

  static getInstance(): CDNOptimizer {
    if (!CDNOptimizer.instance) {
      CDNOptimizer.instance = new CDNOptimizer();
    }
    return CDNOptimizer.instance;
  }

  // Optimize image URLs for CDN
  optimizeImageUrl(originalUrl: string, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'jpg' | 'png';
  } = {}): string {
    if (!originalUrl || !originalUrl.startsWith('http')) {
      return originalUrl;
    }

    const params = new URLSearchParams();

    if (options.width) params.set('w', options.width.toString());
    if (options.height) params.set('h', options.height.toString());
    if (options.quality) params.set('q', options.quality.toString());
    if (options.format) params.set('f', options.format);

    const separator = originalUrl.includes('?') ? '&' : '?';
    return `${originalUrl}${separator}${params.toString()}`;
  }

  // Preload critical resources
  preloadCriticalResources(): void {
    // Preload critical fonts
    const fontLink = document.createElement('link');
    fontLink.rel = 'preload';
    fontLink.href = '/fonts/inter-var.woff2';
    fontLink.as = 'font';
    fontLink.type = 'font/woff2';
    fontLink.crossOrigin = 'anonymous';
    document.head.appendChild(fontLink);

    // Preload critical CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'preload';
    cssLink.href = '/assets/index.css';
    cssLink.as = 'style';
    document.head.appendChild(cssLink);

    // Preload critical JS
    const jsLink = document.createElement('link');
    jsLink.rel = 'preload';
    jsLink.href = '/assets/index.js';
    jsLink.as = 'script';
    document.head.appendChild(jsLink);
  }

  // Resource hints
  addResourceHints(): void {
    // DNS prefetch
    const domains = [
      'api.supabase.co',
      'maps.googleapis.com',
      'fonts.googleapis.com',
      'fonts.gstatic.com',
    ];

    domains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = `//${domain}`;
      document.head.appendChild(link);
    });

    // Preconnect
    const preconnectDomains = ['https://api.supabase.co', 'https://maps.googleapis.com'];

    preconnectDomains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = domain;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }
}

// Cache manager that combines all caching strategies
export class CacheManager {
  private memoryCache = new MemoryCache();
  private indexedDBCache = new IndexedDBCache();
  private httpCache = new HTTPCache();
  private cdnOptimizer = CDNOptimizer.getInstance();

  // Generic cache operations
  async set<T>(key: string, data: T, options: {
    ttl?: number;
    strategy?: 'memory' | 'indexeddb' | 'both';
  } = {}): Promise<void> {
    const { ttl = CACHE_CONFIG.MEDIUM, strategy = 'both' } = options;

    if (strategy === 'memory' || strategy === 'both') {
      this.memoryCache.set(key, data, ttl);
    }

    if (strategy === 'indexeddb' || strategy === 'both') {
      await this.indexedDBCache.set(key, data, ttl);
    }
  }

  async get<T>(key: string, strategy: 'memory' | 'indexeddb' | 'both' = 'both'): Promise<T | null> {
    // Try memory cache first
    if (strategy === 'memory' || strategy === 'both') {
      const memoryData = this.memoryCache.get<T>(key);
      if (memoryData !== null) return memoryData;
    }

    // Try IndexedDB cache
    if (strategy === 'indexeddb' || strategy === 'both') {
      const indexedDBData = await this.indexedDBCache.get<T>(key);
      if (indexedDBData !== null) {
        // Populate memory cache for faster future access
        this.memoryCache.set(key, indexedDBData);
        return indexedDBData;
      }
    }

    return null;
  }

  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await this.indexedDBCache.delete(key);
    this.httpCache.invalidate(key);
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    await this.indexedDBCache.clear();
    this.httpCache.clear();
  }

  // HTTP caching
  async fetchWithCache(
    url: string,
    options: RequestInit = {},
    ttl: number = CACHE_CONFIG.MEDIUM
  ): Promise<Response> {
    return this.httpCache.fetchWithCache(url, options, ttl);
  }

  // CDN optimization
  optimizeImageUrl(url: string, options?: any): string {
    return this.cdnOptimizer.optimizeImageUrl(url, options);
  }

  // Cache statistics
  getStats() {
    return {
      memory: this.memoryCache.getStats(),
      httpCacheSize: 'N/A', // Would need to implement
    };
  }

  // Initialize CDN optimizations
  initializeCDN(): void {
    this.cdnOptimizer.preloadCriticalResources();
    this.cdnOptimizer.addResourceHints();
  }
}

// Supabase-specific caching
export class SupabaseCache {
  private cacheManager = new CacheManager();

  async query<T>(
    queryFn: () => Promise<{ data: T | null; error: any }>,
    cacheKey: string,
    options: {
      ttl?: number;
      force?: boolean;
    } = {}
  ): Promise<{ data: T | null; error: any }> {
    const { ttl = CACHE_CONFIG.MEDIUM, force = false } = options;

    if (!force) {
      const cached = await this.cacheManager.get<T>(cacheKey);
      if (cached !== null) {
        return { data: cached, error: null };
      }
    }

    const result = await queryFn();

    if (result.data && !result.error) {
      await this.cacheManager.set(cacheKey, result.data, { ttl });
    }

    return result;
  }

  async invalidate(pattern: string): Promise<void> {
    // Invalidate cache entries matching pattern
    // This is a simplified implementation
    await this.cacheManager.clear();
  }
}

// Global cache instances
export const cacheManager = new CacheManager();
export const supabaseCache = new SupabaseCache();

// Initialize CDN optimizations on module load
if (typeof window !== 'undefined') {
  cacheManager.initializeCDN();
}