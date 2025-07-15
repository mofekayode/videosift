'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useUser } from '@clerk/nextjs';

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
    quotaLimit: 30,
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
        
        // Set initial limits based on user type
        const baseQuotaLimit = 30; // Everyone gets 30 messages
        const baseChannelLimit = 1;

        // Fetch real message count from API
        let quotaUsed = 0;
        let channelsUsed = 0;

        try {
          const headers: any = {};
          
          // For anonymous users, get anon ID from localStorage
          if (!user) {
            const anonId = localStorage.getItem('vidsift_anon_id');
            if (anonId) {
              headers['x-anon-id'] = anonId;
            }
          }
          
          console.log('🔍 useQuota: Fetching message count, user:', user?.id);
          const response = await fetch('/api/user/message-count', { headers });
          if (response.ok) {
            const data = await response.json();
            console.log('📊 useQuota: Message count response:', data);
            quotaUsed = data.count || 0;
          } else {
            console.error('❌ useQuota: Failed to fetch message count, status:', response.status);
          }
        } catch (error) {
          console.error('Failed to fetch message count from API:', error);
          
          // Fallback to localStorage if API fails
          const storageKey = user ? `quota_${user.id}` : 'quota_anonymous';
          const storedData = localStorage.getItem(storageKey);
          
          if (storedData) {
            try {
              const parsed = JSON.parse(storedData);
              quotaUsed = parsed.quotaUsed || 0;
              channelsUsed = parsed.channelsUsed || 0;
            } catch (error) {
              console.error('Failed to parse stored quota data:', error);
            }
          }
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