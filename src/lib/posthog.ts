import { PostHog } from 'posthog-js';

let posthogInstance: PostHog | null = null;

export const initPostHog = (): PostHog | null => {
  if (typeof window === 'undefined') {
    return null; // Don't initialize on server side
  }

  if (posthogInstance) {
    return posthogInstance;
  }

  // Only initialize if we have a PostHog key
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!posthogKey) {
    console.warn('PostHog key not found. Analytics will be disabled.');
    return null;
  }

  try {
    // Dynamic import to avoid SSR issues
    import('posthog-js').then((posthog) => {
      posthog.default.init(posthogKey, {
        api_host: posthogHost,
        person_profiles: 'identified_only',
        capture_pageview: false, // We'll manually capture pageviews
        capture_pageleave: true,
        loaded: (posthog) => {
          posthogInstance = posthog;
          if (process.env.NODE_ENV === 'development') {
            console.log('PostHog initialized successfully');
          }
        }
      });
    });
  } catch (error) {
    console.error('Failed to initialize PostHog:', error);
  }

  return posthogInstance;
};

export const getPostHog = (): PostHog | null => {
  return posthogInstance;
};

// Analytics event types
export type AnalyticsEvent = 
  | 'video_url_pasted'
  | 'video_processed'
  | 'chat_message_sent'
  | 'user_signed_in'
  | 'user_signed_out'
  | 'channel_added'
  | 'channel_processed'
  | 'quota_reached'
  | 'roadmap_modal_opened'
  | 'beta_cta_clicked'
  | 'error_occurred';

export interface AnalyticsProperties {
  video_id?: string;
  video_title?: string;
  video_duration?: number;
  channel_id?: string;
  channel_title?: string;
  message_length?: number;
  quota_used?: number;
  quota_limit?: number;
  user_type?: 'anonymous' | 'user' | 'premium';
  error_type?: string;
  error_message?: string;
  [key: string]: any;
}

// Analytics tracking functions
export const trackEvent = (event: AnalyticsEvent, properties?: AnalyticsProperties): void => {
  const posthog = getPostHog();
  if (!posthog) return;

  try {
    posthog.capture(event, {
      ...properties,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      url: window.location.href,
      referrer: document.referrer
    });
  } catch (error) {
    console.error('Failed to track event:', error);
  }
};

export const trackPageView = (path?: string): void => {
  const posthog = getPostHog();
  if (!posthog) return;

  try {
    posthog.capture('$pageview', {
      $current_url: path || window.location.href
    });
  } catch (error) {
    console.error('Failed to track page view:', error);
  }
};

export const identifyUser = (userId: string, userProperties?: Record<string, any>): void => {
  const posthog = getPostHog();
  if (!posthog) return;

  try {
    posthog.identify(userId, userProperties);
  } catch (error) {
    console.error('Failed to identify user:', error);
  }
};

export const resetUser = (): void => {
  const posthog = getPostHog();
  if (!posthog) return;

  try {
    posthog.reset();
  } catch (error) {
    console.error('Failed to reset user:', error);
  }
};

// Feature flag functions
export const getFeatureFlag = (flagKey: string): boolean | string | undefined => {
  const posthog = getPostHog();
  if (!posthog) return undefined;

  try {
    return posthog.getFeatureFlag(flagKey);
  } catch (error) {
    console.error('Failed to get feature flag:', error);
    return undefined;
  }
};

export const isFeatureEnabled = (flagKey: string): boolean => {
  const posthog = getPostHog();
  if (!posthog) return false;

  try {
    return posthog.isFeatureEnabled(flagKey) || false;
  } catch (error) {
    console.error('Failed to check feature flag:', error);
    return false;
  }
};