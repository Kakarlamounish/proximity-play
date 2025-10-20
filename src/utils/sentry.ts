import * as Sentry from '@sentry/react';

const initSentry = () => {
  // Only initialize Sentry in production
  if (process.env.NODE_ENV === 'production' && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],

      // Performance Monitoring
      tracesSampleRate: 0.1, // Capture 10% of transactions
      replaysSessionSampleRate: 0.1, // Capture 10% of sessions
      replaysOnErrorSampleRate: 1.0, // Capture 100% of sessions with errors

      // Release tracking
      release: import.meta.env.VERCEL_GIT_COMMIT_SHA || 'development',
      environment: import.meta.env.VERCEL_ENV || 'development',

      // Error filtering
      beforeSend(event, hint) {
        // Filter out network errors that are expected
        if (event.exception) {
          const error = hint.originalException;
          if (error && typeof error === 'object' && 'message' in error) {
            const message = (error as Error).message;
            // Filter out common network errors
            if (message.includes('NetworkError') ||
                message.includes('Failed to fetch') ||
                message.includes('Load failed')) {
              return null;
            }
          }
        }
        return event;
      },

      // User context
      beforeSendTransaction(event) {
        // Add custom transaction context
        if (event.transaction) {
          event.tags = {
            ...event.tags,
            transaction_type: event.transaction,
          };
        }
        return event;
      },
    });

    // Set user context when available
    const setUserContext = (user: any) => {
      if (user) {
        Sentry.setUser({
          id: user.id,
          email: user.email,
          username: user.first_name,
        });
        Sentry.setTag('user_type', user.user_type || 'regular');
      } else {
        Sentry.setUser(null);
      }
    };

    // Performance monitoring helpers
    const startTransaction = (name: string, op: string) => {
      return Sentry.startSpan({
        name,
        op,
      }, () => {});
    };

    const captureException = (error: Error, context?: any) => {
      Sentry.withScope((scope) => {
        if (context) {
          Object.keys(context).forEach(key => {
            scope.setTag(key, context[key]);
          });
        }
        Sentry.captureException(error);
      });
    };

    const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info', context?: any) => {
      Sentry.withScope((scope) => {
        scope.setLevel(level);
        if (context) {
          Object.keys(context).forEach(key => {
            scope.setTag(key, context[key]);
          });
        }
        Sentry.captureMessage(message);
      });
    };

    // Add breadcrumb for user actions
    const addBreadcrumb = (message: string, category: string, level: Sentry.SeverityLevel = 'info', data?: any) => {
      Sentry.addBreadcrumb({
        message,
        category,
        level,
        data,
      });
    };

    return {
      setUserContext,
      startTransaction,
      captureException,
      captureMessage,
      addBreadcrumb,
    };
  }

  // Return mock functions for development
  return {
    setUserContext: () => {},
    startTransaction: () => ({ finish: () => {} }),
    captureException: (error: Error) => console.error('Error captured:', error),
    captureMessage: (message: string) => console.log('Message captured:', message),
    addBreadcrumb: (message: string) => console.log('Breadcrumb added:', message),
  };
};

export const sentry = initSentry();