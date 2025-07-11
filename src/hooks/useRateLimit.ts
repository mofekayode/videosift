'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';

interface RateLimitData {
  hourly: {
    limit: number;
    remaining: number;
    resetTime: Date;
  };
  daily: {
    limit: number;
    remaining: number;
    resetTime: Date;
  };
}

interface UseRateLimitReturn {
  rateLimitData: RateLimitData | null;
  isLoading: boolean;
  error: string | null;
  refreshRateLimit: () => Promise<void>;
  updateFromResponse: (responseData: any) => void;
}

export function useRateLimit(): UseRateLimitReturn {
  const { user } = useUser();
  const [rateLimitData, setRateLimitData] = useState<RateLimitData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRateLimit = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/user/usage-stats');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch rate limit data');
      }
      
      setRateLimitData({
        hourly: {
          limit: data.stats.chat.hourly.limit,
          remaining: data.stats.chat.hourly.remaining,
          resetTime: new Date(data.stats.chat.hourly.resetTime)
        },
        daily: {
          limit: data.stats.chat.daily.limit,
          remaining: data.stats.chat.daily.remaining,
          resetTime: new Date(data.stats.chat.daily.resetTime)
        }
      });
      
    } catch (error) {
      console.error('Error fetching rate limit data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load rate limit data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update rate limit data from chat response
  const updateFromResponse = useCallback((responseData: any) => {
    if (responseData.rateLimit) {
      setRateLimitData({
        hourly: {
          limit: responseData.rateLimit.hourly.limit,
          remaining: responseData.rateLimit.hourly.remaining,
          resetTime: new Date(responseData.rateLimit.hourly.resetTime)
        },
        daily: {
          limit: responseData.rateLimit.daily.limit,
          remaining: responseData.rateLimit.daily.remaining,
          resetTime: new Date(responseData.rateLimit.daily.resetTime)
        }
      });
    }
  }, []);

  // Refresh rate limit data
  const refreshRateLimit = useCallback(async () => {
    await fetchRateLimit();
  }, [fetchRateLimit]);

  // Initial fetch when component mounts
  useEffect(() => {
    fetchRateLimit();
  }, [fetchRateLimit]);

  // Auto-refresh when reset times are reached
  useEffect(() => {
    if (!rateLimitData) return;

    const now = Date.now();
    const hourlyResetTime = rateLimitData.hourly.resetTime.getTime();
    const dailyResetTime = rateLimitData.daily.resetTime.getTime();

    // Set timeout for next reset (whichever comes first)
    const nextResetTime = Math.min(hourlyResetTime, dailyResetTime);
    const timeUntilReset = Math.max(0, nextResetTime - now);

    if (timeUntilReset > 0 && timeUntilReset < 24 * 60 * 60 * 1000) { // Within 24 hours
      const timeoutId = setTimeout(() => {
        fetchRateLimit();
      }, timeUntilReset + 1000); // Add 1 second buffer

      return () => clearTimeout(timeoutId);
    }
  }, [rateLimitData, fetchRateLimit]);

  return {
    rateLimitData,
    isLoading,
    error,
    refreshRateLimit,
    updateFromResponse
  };
}