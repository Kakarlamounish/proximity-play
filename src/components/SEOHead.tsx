import React from 'react';
import { Helmet } from 'react-helmet-async';

// SEO and meta tag management component
interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'profile';
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
  locale?: string;
  alternateLocales?: Array<{ locale: string; url: string }>;
  structuredData?: object;
  canonical?: string;
  noindex?: boolean;
  nofollow?: boolean;
}

export const SEOHead: React.FC<SEOHeadProps> = ({
  title = 'Proximity Play - Connect with People Who Share Your Interests',
  description = 'Discover and join interest-based communities near you. Real-time location sharing, live interactions, and meaningful connections with people who share your passions.',
  keywords = ['social', 'community', 'location', 'interests', 'networking', 'real-time', 'live'],
  image = '/og-image.jpg',
  url,
  type = 'website',
  author,
  publishedTime,
  modifiedTime,
  section,
  tags,
  locale = 'en_US',
  alternateLocales,
  structuredData,
  canonical,
  noindex = false,
  nofollow = false,
}) => {
  const siteName = 'Proximity Play';
  const twitterHandle = '@proximityplay';
  const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;
  const fullUrl = url ? `${window.location.origin}${url}` : window.location.href;
  const fullImage = image.startsWith('http') ? image : `${window.location.origin}${image}`;

  // Generate structured data
  const generateStructuredData = () => {
    const baseData: any = {
      '@context': 'https://schema.org',
      '@type': type === 'website' ? 'WebSite' : type === 'article' ? 'Article' : 'WebPage',
      name: title,
      description,
      url: fullUrl,
      image: fullImage,
      publisher: {
        '@type': 'Organization',
        name: siteName,
        logo: {
          '@type': 'ImageObject',
          url: `${window.location.origin}/logo.svg`,
        },
      },
    };

    if (type === 'article' && (author || publishedTime)) {
      baseData['@type'] = 'Article';
      if (author) {
        baseData.author = {
          '@type': 'Person',
          name: author,
        };
      }
      if (publishedTime) baseData.datePublished = publishedTime;
      if (modifiedTime) baseData.dateModified = modifiedTime;
      if (section) baseData.articleSection = section;
      if (tags) baseData.keywords = tags.join(', ');
    }

    if (type === 'profile' && author) {
      baseData['@type'] = 'ProfilePage';
      baseData.mainEntity = {
        '@type': 'Person',
        name: author,
      };
    }

    return baseData;
  };

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords.join(', ')} />
      <meta name="author" content={author || siteName} />
      <meta name="robots" content={`${noindex ? 'noindex' : 'index'}, ${nofollow ? 'nofollow' : 'follow'}`} />

      {/* Canonical URL */}
      {canonical && <link rel="canonical" href={canonical} />}

      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={locale} />

      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImage} />
      {twitterHandle && <meta name="twitter:site" content={twitterHandle} />}

      {/* Article Specific Meta Tags */}
      {type === 'article' && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {type === 'article' && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {type === 'article' && author && (
        <meta property="article:author" content={author} />
      )}
      {type === 'article' && section && (
        <meta property="article:section" content={section} />
      )}
      {type === 'article' && tags && tags.map(tag => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}

      {/* Alternate Language Links */}
      {alternateLocales && alternateLocales.map(({ locale: altLocale, url: altUrl }) => (
        <link
          key={altLocale}
          rel="alternate"
          hrefLang={altLocale}
          href={altUrl}
        />
      ))}

      {/* Additional Meta Tags */}
      <meta name="theme-color" content="#6366f1" />
      <meta name="msapplication-TileColor" content="#6366f1" />
      <meta name="application-name" content={siteName} />

      {/* Apple Specific Meta Tags */}
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content={siteName} />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData || generateStructuredData())}
      </script>
    </Helmet>
  );
};

// Hook for dynamic SEO updates
export const useSEO = () => {
  const updateSEO = React.useCallback((props: SEOHeadProps) => {
    // This would typically update a context or global state
    // For now, we'll just return the component props
    return props;
  }, []);

  return { updateSEO };
};

// Predefined SEO configurations for common pages
export const SEO_CONFIGS = {
  home: {
    title: 'Proximity Play - Connect with People Who Share Your Interests',
    description: 'Discover and join interest-based communities near you. Real-time location sharing, live interactions, and meaningful connections with people who share your passions.',
    keywords: ['social', 'community', 'location', 'interests', 'networking', 'real-time', 'live'],
    type: 'website' as const,
  },

  discover: {
    title: 'Discover Communities - Find Your Tribe',
    description: 'Explore interest-based communities and bubbles near you. Join conversations, share experiences, and connect with like-minded people in real-time.',
    keywords: ['discover', 'communities', 'bubbles', 'interests', 'explore', 'connect'],
    type: 'website' as const,
  },

  profile: {
    title: 'My Profile - Proximity Play',
    description: 'Manage your profile, view your badges, and customize your experience on Proximity Play.',
    keywords: ['profile', 'settings', 'badges', 'preferences', 'account'],
    type: 'profile' as const,
  },

  messages: {
    title: 'Messages - Stay Connected',
    description: 'Chat with your bubble communities and friends. Real-time messaging with location-based interactions.',
    keywords: ['messages', 'chat', 'communication', 'real-time', 'bubbles'],
    type: 'website' as const,
  },

  live: {
    title: 'Live Features - Real-Time Interactions',
    description: 'Experience real-time location sharing, live status updates, and proximity-based interactions with your community.',
    keywords: ['live', 'real-time', 'location', 'status', 'proximity', 'interactions'],
    type: 'website' as const,
  },

  settings: {
    title: 'Settings - Customize Your Experience',
    description: 'Configure your privacy settings, notifications, and preferences for the best Proximity Play experience.',
    keywords: ['settings', 'privacy', 'notifications', 'preferences', 'customization'],
    type: 'website' as const,
  },
};