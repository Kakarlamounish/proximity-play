import { useEffect } from 'react';

interface WebVitalsProps {
  onReport?: (metric: any) => void;
}

const WebVitals: React.FC<WebVitalsProps> = ({ onReport }) => {
  useEffect(() => {
    // Dynamic import to avoid build issues
    import('web-vitals').then((webVitals: any) => {
      // Core Web Vitals monitoring
      if (webVitals.getCLS) webVitals.getCLS(console.log); // Cumulative Layout Shift
      if (webVitals.getFID) webVitals.getFID(console.log); // First Input Delay
      if (webVitals.getFCP) webVitals.getFCP(console.log); // First Contentful Paint
      if (webVitals.getLCP) webVitals.getLCP(console.log); // Largest Contentful Paint
      if (webVitals.getTTFB) webVitals.getTTFB(console.log); // Time to First Byte

      // Send to analytics if callback provided
      if (onReport) {
        if (webVitals.getCLS) webVitals.getCLS(onReport);
        if (webVitals.getFID) webVitals.getFID(onReport);
        if (webVitals.getFCP) webVitals.getFCP(onReport);
        if (webVitals.getLCP) webVitals.getLCP(onReport);
        if (webVitals.getTTFB) webVitals.getTTFB(onReport);
      }
    }).catch((error) => {
      console.warn('Web Vitals library not available:', error);
    });
  }, [onReport]);

  return null; // This component doesn't render anything
};

export default WebVitals;