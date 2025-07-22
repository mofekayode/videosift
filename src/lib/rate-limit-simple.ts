import { supabaseAdmin } from './supabase';

// This version works with the simple rate_limits table that only has:
// id, identifier, action, created_at

export async function checkRateLimitSimple(
  identifier: string,
  action: string,
  tier: 'anonymous' | 'user' | 'premium',
  windowType: 'hour' | 'day' = 'hour'
) {
  try {
    const now = new Date();
    const windowStart = new Date(now);
    
    // Set window start based on type
    if (windowType === 'hour') {
      windowStart.setHours(windowStart.getHours() - 1);
    } else {
      windowStart.setHours(windowStart.getHours() - 24);
    }
    
    // Count records in the window
    const { count, error } = await supabaseAdmin
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('action', action)
      .gte('created_at', windowStart.toISOString());
    
    if (error) {
      console.error('Error counting rate limits:', error);
      throw error;
    }
    
    // Import the config from the main rate-limit file
    const { QUOTA_CONFIG } = await import('./rate-limit');
    
    const config = QUOTA_CONFIG[tier];
    const limit = windowType === 'hour' 
      ? config.chat_messages_per_hour 
      : config.chat_messages_per_day;
    
    const currentCount = count || 0;
    const allowed = currentCount < limit;
    
    console.log('📊 Simple rate limit check:', {
      identifier,
      action,
      windowType,
      currentCount,
      limit,
      allowed
    });
    
    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - currentCount),
      resetTime: new Date(windowStart.getTime() + (windowType === 'hour' ? 3600000 : 86400000)),
      retryAfter: allowed ? undefined : 3600
    };
  } catch (error) {
    console.error('Error in checkRateLimitSimple:', error);
    // Fail closed
    return {
      allowed: false,
      limit: 0,
      remaining: 0,
      resetTime: new Date(Date.now() + 3600000),
      retryAfter: 3600
    };
  }
}

export async function incrementRateLimitSimple(
  identifier: string,
  action: string
) {
  try {
    console.log('🔺 Attempting to increment rate limit:', { identifier, action });
    
    // Get count before increment
    const { count: countBefore } = await supabaseAdmin
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('action', action);
    
    console.log('📊 Count BEFORE increment:', countBefore);
    
    // Simply insert a new record
    const { data, error } = await supabaseAdmin
      .from('rate_limits')
      .insert({
        identifier,
        action
        // created_at is auto-set by the database
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error incrementing rate limit:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return false;
    }
    
    console.log('✅ Rate limit incremented successfully:', data);
    
    // Verify it was saved by counting
    const { count: countAfter } = await supabaseAdmin
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('action', action);
    
    console.log('📊 Count AFTER increment:', countAfter);
    
    if (countAfter !== (countBefore || 0) + 1) {
      console.error('⚠️ WARNING: Increment may have failed! Expected', (countBefore || 0) + 1, 'but got', countAfter);
    }
    
    return true;
  } catch (error) {
    console.error('Error in incrementRateLimitSimple:', error);
    return false;
  }
}