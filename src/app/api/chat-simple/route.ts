import { NextRequest, NextResponse } from 'next/server';
import { generateChatResponse, extractCitations } from '@/lib/openai';
import { getVideoTranscript, createChatSession, saveChatMessage, getChatMessageCount } from '@/lib/database';
import { auth } from '@clerk/nextjs/server';
import { ensureUserExists } from '@/lib/user-sync';
import { checkRateLimit, incrementRateLimit, getUserTier, getClientIP } from '@/lib/rate-limit';
import { trackApiError, trackRateLimitError, trackExternalServiceError } from '@/lib/error-tracking';
import { logger, LogCategory, logApiRequest } from '@/lib/logger';
import { CacheUtils } from '@/lib/cache';

// Chat session limits
const CHAT_LIMITS = {
  ANONYMOUS_USER: 10, // 10 messages per session for anonymous users
  SIGNED_USER: 50,    // 50 messages per session for signed users
  FREE_TIER: 50,      // Same as signed user for now
  PREMIUM_TIER: 200   // Future premium tier
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const clientIP = getClientIP(request);
  let httpStatus = 200;
  
  try {
    logger.info(LogCategory.API, 'Chat request started', {
      apiEndpoint: '/api/chat-simple',
      ipAddress: clientIP
    });
    
    const { query, videoId, messages = [], sessionId, anonId } = await request.json();
    
    if (!query) {
      httpStatus = 400;
      trackApiError('Missing query parameter', {
        apiEndpoint: '/api/chat-simple',
        ipAddress: clientIP
      });
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    if (!videoId) {
      httpStatus = 400;
      trackApiError('Missing videoId parameter', {
        apiEndpoint: '/api/chat-simple',
        ipAddress: clientIP
      });
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    // Get user authentication
    const { userId } = await auth();
    
    // Get the Supabase user if authenticated
    let supabaseUserId = null;
    if (userId) {
      const user = await ensureUserExists();
      if (user) {
        supabaseUserId = user.id;
      }
    }
    
    // Rate limiting check
    const identifier = userId || getClientIP(request);
    const tier = getUserTier(userId);
    
    // Check both hourly and daily limits
    const [hourlyLimit, dailyLimit] = await Promise.all([
      checkRateLimit(identifier, 'chat', tier, 'hour'),
      checkRateLimit(identifier, 'chat', tier, 'day')
    ]);
    
    if (!hourlyLimit.allowed) {
      httpStatus = 429;
      trackRateLimitError(`Hourly rate limit exceeded for ${tier} user`, {
        userId,
        apiEndpoint: '/api/chat-simple',
        ipAddress: clientIP,
        additionalData: { limit: hourlyLimit.limit, remaining: hourlyLimit.remaining }
      });
      return NextResponse.json({
        error: `Hourly chat limit exceeded. You can send ${hourlyLimit.limit} messages per hour.`,
        rateLimited: true,
        limit: hourlyLimit.limit,
        remaining: hourlyLimit.remaining,
        resetTime: hourlyLimit.resetTime,
        retryAfter: hourlyLimit.retryAfter
      }, { 
        status: 429,
        headers: {
          'Retry-After': hourlyLimit.retryAfter?.toString() || '3600',
          'X-RateLimit-Limit': hourlyLimit.limit.toString(),
          'X-RateLimit-Remaining': hourlyLimit.remaining.toString(),
          'X-RateLimit-Reset': Math.floor(hourlyLimit.resetTime.getTime() / 1000).toString()
        }
      });
    }
    
    if (!dailyLimit.allowed) {
      httpStatus = 429;
      trackRateLimitError(`Daily rate limit exceeded for ${tier} user`, {
        userId,
        apiEndpoint: '/api/chat-simple',
        ipAddress: clientIP,
        additionalData: { limit: dailyLimit.limit, remaining: dailyLimit.remaining }
      });
      return NextResponse.json({
        error: `Daily chat limit exceeded. You can send ${dailyLimit.limit} messages per day.`,
        rateLimited: true,
        limit: dailyLimit.limit,
        remaining: dailyLimit.remaining,
        resetTime: dailyLimit.resetTime,
        retryAfter: dailyLimit.retryAfter
      }, { 
        status: 429,
        headers: {
          'Retry-After': dailyLimit.retryAfter?.toString() || '86400',
          'X-RateLimit-Limit': dailyLimit.limit.toString(),
          'X-RateLimit-Remaining': dailyLimit.remaining.toString(),
          'X-RateLimit-Reset': Math.floor(dailyLimit.resetTime.getTime() / 1000).toString()
        }
      });
    }
    
    // Handle chat session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      // Try to create new session, but don't fail if it doesn't work
      try {
        const session = await createChatSession(supabaseUserId || undefined, anonId, undefined, [videoId]);
        if (session) {
          currentSessionId = session.id;
        } else {
          // Fall back to a temporary session ID if database creation fails
          currentSessionId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          console.log('⚠️ Using temporary session ID due to database setup issues:', currentSessionId);
        }
      } catch (error) {
        // Fall back to a temporary session ID if database creation fails
        currentSessionId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log('⚠️ Using temporary session ID due to error:', error);
      }
    }
    
    console.log(`🔍 Getting transcript for videoId: ${videoId}`);
    console.log(`💬 Using session: ${currentSessionId} (user: ${userId || 'anonymous'})`);

    // Check session limits (only for real sessions, not temporary ones)
    if (!currentSessionId.startsWith('temp_')) {
      try {
        const messageCount = await getChatMessageCount(currentSessionId);
        const limit = userId ? CHAT_LIMITS.SIGNED_USER : CHAT_LIMITS.ANONYMOUS_USER;
        
        console.log(`📊 Session message count: ${messageCount}/${limit}`);
        
        if (messageCount >= limit) {
          return NextResponse.json({
            success: false,
            error: userId 
              ? `You've reached the limit of ${limit} messages per session. Please start a new chat with a different video.`
              : `You've reached the limit of ${limit} messages per session. Sign in for higher limits or start a new chat with a different video.`,
            limitReached: true,
            messageCount,
            limit
          }, { status: 429 });
        }
      } catch (error) {
        console.log('⚠️ Failed to check session limits:', error);
        // Continue without limiting if we can't check
      }
    }
    
    // Check cache for similar query
    const cachedResult = await CacheUtils.getCachedTranscriptSearch(videoId, query);
    if (cachedResult) {
      console.log('🚀 Found cached transcript search result');
      
      // Still need to increment rate limit for cached responses
      await Promise.all([
        incrementRateLimit(identifier, 'chat', 'hour'),
        incrementRateLimit(identifier, 'chat', 'day')
      ]);
      
      // Save to session if needed
      try {
        if (!currentSessionId.startsWith('temp_')) {
          await saveChatMessage(currentSessionId, 'user', query);
          await saveChatMessage(currentSessionId, 'assistant', cachedResult.response, cachedResult.citations);
        }
      } catch (error) {
        console.log('⚠️ Failed to save cached messages:', error);
      }
      
      return NextResponse.json({
        ...cachedResult,
        cached: true,
        sessionId: currentSessionId
      });
    }

    // Get all transcript chunks for this video (no embedding search needed)
    const chunks = await getVideoTranscript(videoId);
    
    console.log(`📊 Found ${chunks.length} transcript chunks for query: "${query}"`);
    
    if (chunks.length === 0) {
      return NextResponse.json({
        success: true,
        response: "I couldn't find the transcript for this video. The video may not have captions available.",
        citations: []
      });
    }
    
    // Prepare transcript chunks for AI (sorted by timestamp)
    const transcriptChunks = chunks
      .sort((a, b) => a.start_sec - b.start_sec)
      .map(chunk => ({
        text: chunk.text,
        start_sec: chunk.start_sec,
        end_sec: chunk.end_sec,
      }));
    
    // Generate AI response with the full transcript
    const response = await generateChatResponse(
      [
        ...messages,
        { role: 'user', content: query }
      ],
      transcriptChunks,
      'gpt-4o-mini'
    );
    
    if (!response) {
      return NextResponse.json(
        { error: 'Failed to generate response' },
        { status: 500 }
      );
    }
    
    // Extract citations from response
    const citations = extractCitations(response);
    
    // Increment rate limit counters for successful chat
    await Promise.all([
      incrementRateLimit(identifier, 'chat', 'hour'),
      incrementRateLimit(identifier, 'chat', 'day')
    ]);
    
    // Save messages to database (optional, will fail silently if tables don't exist)
    try {
      if (!currentSessionId.startsWith('temp_')) {
        await saveChatMessage(currentSessionId, 'user', query);
        await saveChatMessage(currentSessionId, 'assistant', response, citations);
      } else {
        console.log('⚠️ Skipping message save for temporary session');
      }
    } catch (error) {
      console.log('⚠️ Failed to save chat messages (database tables may not exist):', error);
    }
    
    // Get updated session info for response
    let sessionInfo = {};
    if (!currentSessionId.startsWith('temp_')) {
      try {
        const messageCount = await getChatMessageCount(currentSessionId);
        const limit = userId ? CHAT_LIMITS.SIGNED_USER : CHAT_LIMITS.ANONYMOUS_USER;
        sessionInfo = {
          messageCount: messageCount + 2, // +2 for the current user and assistant messages
          limit,
          remaining: Math.max(0, limit - (messageCount + 2))
        };
      } catch (error) {
        console.log('⚠️ Failed to get session info for response:', error);
      }
    }

    // Get updated rate limit info for response headers
    const updatedHourlyLimit = await checkRateLimit(identifier, 'chat', tier, 'hour');
    const updatedDailyLimit = await checkRateLimit(identifier, 'chat', tier, 'day');
    
    const responseData = {
      success: true,
      response,
      citations: citations.map(citation => ({
        timestamp: citation.timestamp,
        text: findChunkByTimestamp(transcriptChunks, citation.timestamp)?.text || '',
        video_id: videoId
      })),
      chunks_used: chunks.length,
      sessionId: currentSessionId,
      sessionInfo,
      rateLimit: {
        hourly: {
          limit: updatedHourlyLimit.limit,
          remaining: updatedHourlyLimit.remaining,
          resetTime: updatedHourlyLimit.resetTime
        },
        daily: {
          limit: updatedDailyLimit.limit,
          remaining: updatedDailyLimit.remaining,
          resetTime: updatedDailyLimit.resetTime
        }
      }
    };
    
    // Cache the result for similar future queries
    try {
      await CacheUtils.cacheTranscriptSearch(videoId, query, {
        success: true,
        response,
        citations: responseData.citations,
        chunks_used: chunks.length
      });
      console.log('💾 Cached transcript search result');
    } catch (error) {
      console.log('⚠️ Failed to cache result:', error);
    }
    
    return NextResponse.json(responseData, {
      headers: {
        'X-RateLimit-Limit-Hourly': updatedHourlyLimit.limit.toString(),
        'X-RateLimit-Remaining-Hourly': updatedHourlyLimit.remaining.toString(),
        'X-RateLimit-Reset-Hourly': Math.floor(updatedHourlyLimit.resetTime.getTime() / 1000).toString(),
        'X-RateLimit-Limit-Daily': updatedDailyLimit.limit.toString(),
        'X-RateLimit-Remaining-Daily': updatedDailyLimit.remaining.toString(),
        'X-RateLimit-Reset-Daily': Math.floor(updatedDailyLimit.resetTime.getTime() / 1000).toString()
      }
    });
    
  } catch (error) {
    httpStatus = 500;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    trackApiError('Chat API internal error', {
      userId,
      apiEndpoint: '/api/chat-simple',
      ipAddress: clientIP,
      additionalData: { error: errorMessage }
    });
    
    logger.error(LogCategory.API, 'Simple chat API error', {
      userId,
      apiEndpoint: '/api/chat-simple',
      ipAddress: clientIP
    }, error as Error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    // Log API request completion
    const duration = Date.now() - startTime;
    logApiRequest('POST', '/api/chat-simple', httpStatus, duration, {
      userId,
      ipAddress: clientIP
    });
  }
}

// Helper function to find chunk by timestamp
function findChunkByTimestamp(chunks: Array<{ start_sec: number; end_sec: number; text: string }>, timestamp: string) {
  // Parse timestamp to seconds
  const parts = timestamp.split(':').map(Number);
  let seconds = 0;
  
  if (parts.length === 2) {
    seconds = parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  
  // Find chunk that contains this timestamp
  return chunks.find(chunk => 
    seconds >= chunk.start_sec && seconds <= chunk.end_sec
  );
}