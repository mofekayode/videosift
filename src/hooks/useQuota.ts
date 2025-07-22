'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useUser } from '@clerk/nextjs';
import { QUOTA_CONFIG, getUserTier } from '@/lib/rate-limit';

interface QuotaData {
  quotaUsed: number;
  quotaLimit: number;
  channelsUsed: number;
  channelLimit: number;
  userType: 'anonymous' | 'user' | 'premium';
  isLoading: boolean;
  error: string | null;
}

export function useQuota(): QuotaData {
  const { user } = useUser();
  const [quotaData, setQuotaData] = useState<QuotaData>({
    quotaUsed: 0,
    quotaLimit: QUOTA_CONFIG.anonymous.chat_messages_per_day, // Use config default
    channelsUsed: 0,
    channelLimit: 1,
    userType: 'anonymous',
    isLoading: true,
    error: null
  });

  useEffect(() => {
    async function fetchQuotaData() {
      try {
        setQuotaData(prev => ({ ...prev, isLoading: true, error: null }));

        // Determine user type
        const userType = user ? 'user' : 'anonymous';
        const tier = getUserTier(user?.id);
        
        // Set initial limits from config (will be updated from API)
        let baseQuotaLimit = QUOTA_CONFIG[tier].chat_messages_per_day;
        let baseChannelLimit = QUOTA_CONFIG[tier].channels_per_user || 1;

        // Fetch real usage stats from API
        let quotaUsed = 0;
        let channelsUsed = 0;

        // Just use the message count API that works everywhere else
        try {
          const headers: any = {};
          if (!user) {
            const anonId = localStorage.getItem('vidsift_anon_id');
            if (anonId) {
              headers['x-anon-id'] = anonId;
            }
          }
          
          const response = await fetch('/api/user/message-count', { headers });
          if (response.ok) {
            const data = await response.json();
            quotaUsed = data.count || 0;
          }
        } catch (error) {
          console.error('Failed to fetch message count:', error);
        }

        setQuotaData({
          quotaUsed,
          quotaLimit: baseQuotaLimit,
          channelsUsed,
          channelLimit: baseChannelLimit,
          userType,
          isLoading: false,
          error: null
        });

      } catch (error) {
        console.error('Failed to fetch quota data:', error);
        setQuotaData(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: 'Failed to load quota information' 
        }));
      }
    }

    fetchQuotaData();
  }, [user]);

  return quotaData;
}

export function incrementQuotaUsage(): void {
  // Get current user ID from localStorage to avoid Clerk hooks outside of React components
  let userId: string | null = null;
  try {
    userId = localStorage.getItem('clerk-user-id');
  } catch (error) {
    console.error('Failed to get user ID from localStorage:', error);
  }
  
  const storageKey = userId ? `quota_${userId}` : 'quota_anonymous';
  
  try {
    const storedData = localStorage.getItem(storageKey);
    let data = { quotaUsed: 0, channelsUsed: 0 };
    
    if (storedData) {
      data = JSON.parse(storedData);
    }
    
    data.quotaUsed = (data.quotaUsed || 0) + 1;
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to increment quota usage:', error);
  }
}

export function incrementChannelUsage(): void {
  // Get current user ID from localStorage to avoid Clerk hooks outside of React components
  let userId: string | null = null;
  try {
    userId = localStorage.getItem('clerk-user-id');
  } catch (error) {
    console.error('Failed to get user ID from localStorage:', error);
  }
  
  const storageKey = userId ? `quota_${userId}` : 'quota_anonymous';
  
  try {
    const storedData = localStorage.getItem(storageKey);
    let data = { quotaUsed: 0, channelsUsed: 0 };
    
    if (storedData) {
      data = JSON.parse(storedData);
    }
    
    data.channelsUsed = (data.channelsUsed || 0) + 1;
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to increment channel usage:', error);
  }
}