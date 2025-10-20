import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

// Analytics configuration
export const ANALYTICS_CONFIG = {
  // User behavior tracking
  events: {
    // Authentication events
    SIGN_UP: 'user_signup',
    SIGN_IN: 'user_signin',
    SIGN_OUT: 'user_signout',

    // Navigation events
    PAGE_VIEW: 'page_view',
    BUBBLE_VIEW: 'bubble_view',
    PROFILE_VIEW: 'profile_view',

    // Interaction events
    MESSAGE_SEND: 'message_send',
    FRIEND_REQUEST: 'friend_request',
    BUBBLE_JOIN: 'bubble_join',
    STORY_CREATE: 'story_create',

    // Feature usage events
    LOCATION_SHARE: 'location_share',
    PUSH_NOTIFICATION: 'push_notification',
    EMERGENCY_SHARE: 'emergency_share',

    // Error events
    ERROR_OCCURRED: 'error_occurred',
    API_ERROR: 'api_error',
  },

  // Custom dimensions
  dimensions: {
    USER_TYPE: 'user_type',
    BUBBLE_SIZE: 'bubble_size',
    SESSION_DURATION: 'session_duration',
    DEVICE_TYPE: 'device_type',
    LOCATION_ACCURACY: 'location_accuracy',
  },

  // Goals and conversions
  goals: {
    USER_ENGAGEMENT: 'user_engagement',
    BUBBLE_CREATION: 'bubble_creation',
    FRIENDSHIP_FORMATION: 'friendship_formation',
    STORY_VIEWS: 'story_views',
  },
};

// Analytics service class
export class AnalyticsService {
  private static instance: AnalyticsService;
  private userId: string | null = null;
  private sessionId: string;
  private eventQueue: any[] = [];
  private isInitialized = false;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.initialize();
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  private initialize(): void {
    if (typeof window === 'undefined') return;

    // Initialize Vercel Analytics
    this.isInitialized = true;

    // Set up automatic page view tracking
    this.trackPageView();

    // Track session start
    this.trackEvent('session_start', {
      session_id: this.sessionId,
      user_agent: navigator.userAgent,
      referrer: document.referrer,
      timestamp: new Date().toISOString(),
    });
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // User identification
  setUserId(userId: string): void {
    this.userId = userId;
    this.trackEvent('user_identified', {
      user_id: userId,
      session_id: this.sessionId,
    });
  }

  // Event tracking
  trackEvent(eventName: string, properties: Record<string, any> = {}): void {
    if (!this.isInitialized) return;

    const event = {
      event: eventName,
      properties: {
        ...properties,
        user_id: this.userId,
        session_id: this.sessionId,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        user_agent: navigator.userAgent,
      },
    };

    // Queue event for batching
    this.eventQueue.push(event);

    // Send immediately for critical events
    if (this.isCriticalEvent(eventName)) {
      this.flushEvents();
    } else {
      // Batch non-critical events
      this.scheduleFlush();
    }

    // Also send to Vercel Analytics
    try {
      // Use Vercel Analytics API
      (window as any).va?.('event', {
        name: eventName,
        properties,
      });
    } catch (error) {
      console.warn('Vercel Analytics not available:', error);
    }
  }

  private isCriticalEvent(eventName: string): boolean {
    const criticalEvents = [
      ANALYTICS_CONFIG.events.ERROR_OCCURRED,
      ANALYTICS_CONFIG.events.EMERGENCY_SHARE,
      ANALYTICS_CONFIG.events.SIGN_OUT,
    ];
    return criticalEvents.includes(eventName);
  }

  private scheduleFlush(): void {
    // Debounce event sending
    if (this.eventQueue.length >= 10) {
      this.flushEvents();
    } else {
      setTimeout(() => this.flushEvents(), 5000);
    }
  }

  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Send to custom analytics endpoint
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      });
    } catch (error) {
      console.warn('Failed to send analytics events:', error);
      // Re-queue events for retry
      this.eventQueue.unshift(...events);
    }
  }

  // Page view tracking
  trackPageView(pageName?: string): void {
    const page = pageName || window.location.pathname;
    this.trackEvent(ANALYTICS_CONFIG.events.PAGE_VIEW, {
      page,
      title: document.title,
      referrer: document.referrer,
    });
  }

  // User interaction tracking
  trackInteraction(element: string, action: string, properties: Record<string, any> = {}): void {
    this.trackEvent('user_interaction', {
      element,
      action,
      ...properties,
    });
  }

  // Performance tracking
  trackPerformance(metric: string, value: number, properties: Record<string, any> = {}): void {
    this.trackEvent('performance_metric', {
      metric,
      value,
      ...properties,
    });
  }

  // Error tracking
  trackError(error: Error, context: Record<string, any> = {}): void {
    this.trackEvent(ANALYTICS_CONFIG.events.ERROR_OCCURRED, {
      error_message: error.message,
      error_stack: error.stack,
      error_name: error.name,
      ...context,
    });
  }

  // Feature usage tracking
  trackFeatureUsage(feature: string, properties: Record<string, any> = {}): void {
    this.trackEvent('feature_usage', {
      feature,
      ...properties,
    });
  }

  // Conversion tracking
  trackConversion(goal: string, value?: number, properties: Record<string, any> = {}): void {
    this.trackEvent('conversion', {
      goal,
      value,
      ...properties,
    });
  }

  // A/B testing
  trackExperiment(experimentId: string, variant: string, properties: Record<string, any> = {}): void {
    this.trackEvent('experiment_view', {
      experiment_id: experimentId,
      variant,
      ...properties,
    });
  }

  // User journey tracking
  trackUserJourney(step: string, properties: Record<string, any> = {}): void {
    this.trackEvent('user_journey', {
      step,
      ...properties,
    });
  }

  // Real-time analytics
  getRealtimeStats(): Promise<any> {
    return fetch('/api/analytics/realtime')
      .then(res => res.json())
      .catch(error => {
        console.warn('Failed to fetch realtime stats:', error);
        return {};
      });
  }

  // Historical analytics
  getHistoricalStats(timeframe: string): Promise<any> {
    return fetch(`/api/analytics/historical?timeframe=${timeframe}`)
      .then(res => res.json())
      .catch(error => {
        console.warn('Failed to fetch historical stats:', error);
        return {};
      });
  }
}

// Global analytics instance
export const analytics = AnalyticsService.getInstance();

// React components for analytics
export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return React.createElement(React.Fragment, null, children, React.createElement(Analytics), React.createElement(SpeedInsights));
};

// Custom hooks for analytics
export const useAnalytics = () => {
  return {
    trackEvent: analytics.trackEvent.bind(analytics),
    trackPageView: analytics.trackPageView.bind(analytics),
    trackInteraction: analytics.trackInteraction.bind(analytics),
    trackError: analytics.trackError.bind(analytics),
    trackFeatureUsage: analytics.trackFeatureUsage.bind(analytics),
    setUserId: analytics.setUserId.bind(analytics),
  };
};

// Performance monitoring hook
export const usePerformanceTracking = () => {
  const trackPerformance = (metric: string, value: number) => {
    analytics.trackPerformance(metric, value);
  };

  const trackWebVitals = (metric: any) => {
    analytics.trackPerformance(`web_vitals_${metric.name}`, metric.value, {
      rating: metric.rating,
      delta: metric.delta,
    });
  };

  return {
    trackPerformance,
    trackWebVitals,
  };
};

// User behavior tracking hook
export const useBehaviorTracking = () => {
  const trackClick = (element: string, properties: Record<string, any> = {}) => {
    analytics.trackInteraction(element, 'click', properties);
  };

  const trackHover = (element: string, duration: number) => {
    analytics.trackInteraction(element, 'hover', { duration });
  };

  const trackScroll = (depth: number) => {
    analytics.trackInteraction('page', 'scroll', { depth });
  };

  const trackTimeSpent = (page: string, duration: number) => {
    analytics.trackEvent('time_spent', { page, duration });
  };

  return {
    trackClick,
    trackHover,
    trackScroll,
    trackTimeSpent,
  };
};