import { supabase } from './supabase';

export interface RateLimit {
  identifier: string; // userId or IP address
  action: string; // 'chat', 'video_upload', 'channel_process'
  count: number;
  window_start: string;
  expires_at: string;
}

export interface QuotaConfig {
  anonymous: {
    chat_messages_per_day: number;
    chat_messages_per_hour: number;
    video_uploads_per_day: number;
  };
  user: {
    chat_messages_per_day: number;
    chat_messages_per_hour: number;
    video_uploads_per_day: number;
    channels_per_user: number;
  };
  premium: {
    chat_messages_per_day: number;
    chat_messages_per_hour: number;
    video_uploads_per_day: number;
    channels_per_user: number;
  };
}

export const QUOTA_CONFIG: QuotaConfig = {
  anonymous: {
    chat_messages_per_day: 30,
    chat_messages_per_hour: 30,
    video_uploads_per_day: 2,
  },
  user: {
    chat_messages_per_day: 30,
    chat_messages_per_hour: 30,
    video_uploads_per_day: 10,
    channels_per_user: 1,
  },
  premium: {
    chat_messages_per_day: 30,
    chat_messages_per_hour: 30,
    video_uploads_per_day: 50,
    channels_per_user: 10,
  },
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number; // seconds
}

// Check rate limit for a specific action
export async function checkRateLimit(
  identifier: string,
  action: string,
  tier: 'anonymous' | 'user' | 'premium' = 'user',
  windowType: 'hour' | 'day' = 'hour'
): Promise<RateLimitResult> {
  try {
    const now = new Date();
    const windowStart = new Date(now);
    
    // Set window start based on type
    if (windowType === 'hour') {
      windowStart.setMinutes(0, 0, 0);
    } else {
      windowStart.setHours(0, 0, 0, 0);
    }
    
    const windowEnd = new Date(windowStart);
    if (windowType === 'hour') {
      windowEnd.setHours(windowEnd.getHours() + 1);
    } else {
      windowEnd.setDate(windowEnd.getDate() + 1);
    }
    
    // Get current usage
    const { data: currentUsage, error } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('identifier', identifier)
      .eq('action', action)
      .gte('window_start', windowStart.toISOString())
      .single();
    
    // Determine limit based on action and tier
    let limit = 0;
    const config = QUOTA_CONFIG[tier];
    
    switch (action) {
      case 'chat':
        limit = windowType === 'hour' ? config.chat_messages_per_hour : config.chat_messages_per_day;
        break;
      case 'video_upload':
        limit = config.video_uploads_per_day;
        break;
      case 'channel_process':
        limit = config.channels_per_user;
        break;
      default:
        limit = 10; // Default fallback
    }
    
    const currentCount = currentUsage?.count || 0;
    const remaining = Math.max(0, limit - currentCount);
    const allowed = currentCount < limit;
    
    return {
      allowed,
      limit,
      remaining,
      resetTime: windowEnd,
      retryAfter: allowed ? undefined : Math.ceil((windowEnd.getTime() - now.getTime()) / 1000),
    };
    
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // Fail open - allow the request if we can't check
    return {
      allowed: true,
      limit: 1000,
      remaining: 999,
      resetTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    };
  }
}

// Increment usage counter
export async function incrementRateLimit(
  identifier: string,
  action: string,
  windowType: 'hour' | 'day' = 'hour'
): Promise<boolean> {
  try {
    const now = new Date();
    const windowStart = new Date(now);
    
    // Set window start based on type
    if (windowType === 'hour') {
      windowStart.setMinutes(0, 0, 0);
    } else {
      windowStart.setHours(0, 0, 0, 0);
    }
    
    const windowEnd = new Date(windowStart);
    if (windowType === 'hour') {
      windowEnd.setHours(windowEnd.getHours() + 1);
    } else {
      windowEnd.setDate(windowEnd.getDate() + 1);
    }
    
    // Try to increment existing record
    const { data: existing } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('identifier', identifier)
      .eq('action', action)
      .gte('window_start', windowStart.toISOString())
      .single();
    
    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from('rate_limits')
        .update({ 
          count: existing.count + 1,
          expires_at: windowEnd.toISOString()
        })
        .eq('id', existing.id);
      
      return !error;
    } else {
      // Create new record
      const { error } = await supabase
        .from('rate_limits')
        .insert({
          identifier,
          action,
          count: 1,
          window_start: windowStart.toISOString(),
          expires_at: windowEnd.toISOString()
        });
      
      return !error;
    }
    
  } catch (error) {
    console.error('Error incrementing rate limit:', error);
    return false;
  }
}

// Get usage statistics for a user
export async function getUsageStats(
  identifier: string,
  tier: 'anonymous' | 'user' | 'premium' = 'user'
): Promise<{
  chat: { hourly: RateLimitResult; daily: RateLimitResult };
  videoUpload: RateLimitResult;
  channelProcess?: RateLimitResult;
}> {
  const [chatHourly, chatDaily, videoUpload] = await Promise.all([
    checkRateLimit(identifier, 'chat', tier, 'hour'),
    checkRateLimit(identifier, 'chat', tier, 'day'),
    checkRateLimit(identifier, 'video_upload', tier, 'day'),
  ]);
  
  // For channel processing, count actual channels instead of using rate limit
  let channelProcess = null;
  if (tier !== 'anonymous') {
    try {
      // Count user's actual channels
      const { count, error } = await supabase
        .from('channels')
        .select('*', { count: 'exact', head: true })
        .eq('owner_user_id', identifier);
      
      const channelCount = count || 0;
      const limit = QUOTA_CONFIG[tier].channels_per_user;
      
      console.log(`📊 Channel count for user ${identifier}: ${channelCount}/${limit}`);
      
      channelProcess = {
        allowed: channelCount < limit,
        limit: limit,
        remaining: Math.max(0, limit - channelCount),
        resetTime: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year (effectively never resets)
      };
    } catch (error) {
      console.error('Error counting channels:', error);
      // Fallback to regular rate limit check
      channelProcess = await checkRateLimit(identifier, 'channel_process', tier, 'day');
    }
  }
  
  return {
    chat: { hourly: chatHourly, daily: chatDaily },
    videoUpload,
    ...(channelProcess && { channelProcess }),
  };
}

// Clean up expired rate limit records
export async function cleanupExpiredRateLimits(): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('rate_limits')
      .delete()
      .lt('expires_at', now);
    
    if (error) {
      console.error('Error cleaning up expired rate limits:', error);
    } else {
      console.log('✅ Cleaned up expired rate limit records');
    }
  } catch (error) {
    console.error('Error in cleanup process:', error);
  }
}

// Get IP address from request
export function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  return 'unknown';
}

// Determine user tier based on subscription status
export function getUserTier(userId?: string, subscription?: any): 'anonymous' | 'user' | 'premium' {
  if (!userId) return 'anonymous';
  if (subscription?.plan === 'premium') return 'premium';
  return 'user';
}