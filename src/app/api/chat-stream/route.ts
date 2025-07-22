import { NextRequest, NextResponse } from 'next/server';
import { hybridChunkSearch } from '@/lib/rag-search';
import { OpenAI } from 'openai';
import { auth } from '@clerk/nextjs/server';
import { ensureUserExists } from '@/lib/user-sync';
import { getUserTier, getClientIP, QUOTA_CONFIG } from '@/lib/rate-limit';
import { createChatSession, saveChatMessage, getChatMessageCount, getVideoByYouTubeId, getChatMessagesBySession } from '@/lib/database';
import { trackApiError, trackRateLimitError } from '@/lib/error-tracking';
import { logger, LogCategory, logApiRequest } from '@/lib/logger';
import { CacheUtils } from '@/lib/cache';
import { supabaseAdmin } from '@/lib/supabase';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Chat session limits
const CHAT_LIMITS = {
  ANONYMOUS_USER: 10,
  SIGNED_USER: 50,
  FREE_TIER: 50,
  PREMIUM_TIER: 200
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let httpStatus = 200;
  let userId: string | null = null;
  const clientIP = getClientIP(request);
  
  try {
    logger.info(LogCategory.API, 'Chat stream request started', {
      apiEndpoint: '/api/chat-stream',
      ipAddress: clientIP
    });
    
    const { query, videoId, messages = [], sessionId, anonId, threadId } = await request.json();
    
    console.log('📨 Request received:', { query: query?.substring(0, 50), videoId, sessionId, anonId });
    
    if (!query || !videoId) {
      httpStatus = 400;
      return NextResponse.json(
        { error: 'Query and videoId are required' },
        { status: 400 }
      );
    }

    // Get user authentication
    const authResult = await auth();
    userId = authResult.userId;
    
    // Get the Supabase user if authenticated
    let supabaseUserId = null;
    if (userId) {
      const user = await ensureUserExists();
      if (user) {
        supabaseUserId = user.id;
      }
    }
    
    // Check rate limit before processing
    const identifier = supabaseUserId || clientIP;
    const tier = getUserTier(userId ?? undefined);
    const dailyLimit = QUOTA_CONFIG[tier].chat_messages_per_day;
    
    // Get today's date range
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    
    // Count messages sent today
    let messageCount = 0;
    try {
      if (supabaseUserId) {
        // Count for authenticated user
        const { data: messages, error } = await supabaseAdmin
          .from('chat_messages')
          .select(`
            id,
            chat_sessions!inner (
              id,
              user_id
            )
          `, { count: 'exact' })
          .eq('chat_sessions.user_id', supabaseUserId)
          .eq('role', 'user')
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString());
        
        messageCount = messages?.length || 0;
      } else if (anonId) {
        // Count for anonymous user
        const { data: messages, error } = await supabaseAdmin
          .from('chat_messages')
          .select(`
            id,
            chat_sessions!inner (
              id,
              anon_id
            )
          `, { count: 'exact' })
          .eq('chat_sessions.anon_id', anonId)
          .eq('role', 'user')
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString());
        
        messageCount = messages?.length || 0;
      }
    } catch (error) {
      console.error('Error counting messages:', error);
    }
    
    console.log('🚦 Rate limit check:', { identifier, tier, userId, dailyLimit, messageCount });
    
    // Enforce rate limit
    if (messageCount >= dailyLimit) {
      httpStatus = 429;
      return NextResponse.json({
        error: `Daily limit reached! You've sent ${messageCount} out of ${dailyLimit} messages today.`,
        limitReached: true,
        messageCount,
        limit: dailyLimit,
        resetTime: tomorrow.toISOString()
      }, { status: 429 });
    }
    
    // Get video info using YouTube ID
    const video = await getVideoByYouTubeId(videoId);
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Handle chat session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      try {
        const session = await createChatSession(
          supabaseUserId || undefined, 
          anonId, 
          undefined, 
          [video.id]  // Use the UUID from the database
        );
        if (session) {
          currentSessionId = session.id;
        } else {
          currentSessionId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        }
      } catch (error) {
        currentSessionId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }
    }
    
    // Check session limits
    if (!currentSessionId.startsWith('temp_')) {
      try {
        const messageCount = await getChatMessageCount(currentSessionId);
        const limit = userId ? CHAT_LIMITS.SIGNED_USER : CHAT_LIMITS.ANONYMOUS_USER;
        
        if (messageCount >= limit) {
          return NextResponse.json({
            success: false,
            error: userId 
              ? `You've reached the limit of ${limit} messages per session. Please start a new chat.`
              : `You've reached the limit of ${limit} messages per session. Sign in for higher limits.`,
            limitReached: true,
            messageCount,
            limit
          }, { status: 429 });
        }
      } catch (error) {
        console.log('Failed to check session limits:', error);
      }
    }

    // Check if chunks are processed
    if (!video.chunks_processed) {
      // For legacy videos without chunks, return a non-streaming response
      return NextResponse.json({
        success: false,
        error: 'This video needs to be reprocessed. Please refresh the page.',
        needsReprocessing: true
      }, { status: 503 });
    }

    // Check cache for similar query
    const cachedResult = await CacheUtils.getCachedTranscriptSearch(video.id, query);
    if (cachedResult) {
      console.log('🚀 Found cached transcript search result');
      
      // Rate limit already incremented above to prevent race conditions
      
      // Return cached result as a non-streaming response
      return NextResponse.json({
        ...cachedResult,
        cached: true,
        sessionId: currentSessionId
      });
    }

    // Retrieve relevant chunks - increase to 10 for better context
    const relevantChunks = await hybridChunkSearch(video.id, video.youtube_id, query, 10);

    if (relevantChunks.length === 0) {
      return NextResponse.json(
        { error: 'No relevant content found in the video' },
        { status: 404 }
      );
    }

    console.log(`📦 Retrieved ${relevantChunks.length} chunks`);
    if (relevantChunks[0]?.text) {
      console.log('First chunk sample:', relevantChunks[0].text.substring(0, 200));
      // Check if timestamps are present
      const hasTimestamps = relevantChunks[0].text.includes('[') && relevantChunks[0].text.includes(':');
      console.log('Timestamps present:', hasTimestamps);
      
      // Debug: Show all timestamps found in chunks
      const allTimestamps = [];
      relevantChunks.forEach(chunk => {
        const timestampMatches = chunk.text.match(/\[\d+:\d+\]/g);
        if (timestampMatches) {
          allTimestamps.push(...timestampMatches);
        }
      });
      console.log('All timestamps found in chunks:', allTimestamps.slice(0, 10));
    }

    // Build context from chunks
    const context = relevantChunks
      .map(chunk => chunk.text)
      .join('\n\n---\n\n');

    // Create chat completion
    const systemPrompt = `You are an AI assistant that has carefully watched and analyzed this YouTube video. You understand not just the words spoken, but the full context of what's being presented.

CRITICAL RULES FOR CITATIONS:
1. ONLY cite timestamps for moments you've observed in the video content below
2. When you cite a timestamp, reference what happens at that moment
3. Never make up or guess timestamps - only use ones from the video segments provided
4. If you're summarizing multiple parts, cite each specific moment you're drawing from
5. Format: "At [X:XX], you can see..." or "The creator shows at [X:XX]..."

IMPORTANT: When users ask for specific data, statistics, or numbers:
- Carefully scan ALL provided video segments for the exact information
- If the data is present, cite it with the specific timestamp
- NEVER say information isn't in the video without thoroughly checking all segments
- Look for numbers, statistics, and data points throughout the entire video

When answering:
- Speak as if you've watched the video, not read a transcript
- Reference what was shown, demonstrated, or explained
- Be conversational and helpful
- Keep responses concise but informative
- Never mention "transcript" - you're analyzing the video itself

Video content with timestamps:

${context}`;

    // Load previous messages from session for context
    let previousMessages: Array<{role: 'user' | 'assistant', content: string}> = [];
    if (!currentSessionId.startsWith('temp_')) {
      try {
        const chatHistory = await getChatMessagesBySession(currentSessionId);
        // Only include the last 10 messages to avoid token limits
        previousMessages = chatHistory.slice(-10).map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }));
        console.log(`📜 Loaded ${previousMessages.length} previous messages for context`);
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    }

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...previousMessages,
        { role: 'user', content: `${query}\n\nPlease include specific timestamps when referencing different parts of the video.` }
      ],
      stream: true,
      temperature: 0.3,  // Lower temperature for more accurate citations
      max_tokens: 1000,
    });

    // Rate limit already incremented above to prevent race conditions

    // Save initial user message
    if (!currentSessionId.startsWith('temp_')) {
      try {
        await saveChatMessage(currentSessionId, 'user', query);
      } catch (error) {
        console.error('Failed to save user message:', error);
      }
    }

    // Create a TransformStream to collect the response
    let fullResponse = '';
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        controller.enqueue(chunk);
        // Collect the response text
        const text = decoder.decode(chunk, { stream: true });
        fullResponse += text;
      },
      
      async flush() {
        // Save the complete response
        if (!currentSessionId.startsWith('temp_')) {
          try {
            await saveChatMessage(currentSessionId, 'assistant', fullResponse);
          } catch (error) {
            console.error('Failed to save assistant message:', error);
          }
        }
        
        // Cache the result
        try {
          await CacheUtils.cacheTranscriptSearch(video.id, query, {
            success: true,
            response: fullResponse,
            citations: [], // Citations are embedded in the response
            chunks_used: relevantChunks.length
          });
        } catch (error) {
          console.error('Failed to cache result:', error);
        }
      }
    });

    // Convert OpenAI stream to web stream
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const part of stream) {
          const text = part.choices[0]?.delta?.content || '';
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      },
    });

    // Pipe through transform stream
    const responseStream = readableStream.pipeThrough(transformStream);
    
    // Remove broken rate limit check - we already counted from chat_sessions

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Session-ID': currentSessionId,
        'X-RateLimit-Limit-Daily': dailyLimit.toString(),
        'X-RateLimit-Remaining-Daily': Math.max(0, dailyLimit - (messageCount + 1)).toString(),
        'X-RateLimit-Reset-Daily': Math.floor(tomorrow.getTime() / 1000).toString()
      },
    });

  } catch (error) {
    httpStatus = 500;
    console.error('Chat stream error:', error);
    
    trackApiError('Chat stream API error', {
      userId: userId || undefined,
      apiEndpoint: '/api/chat-stream',
      ipAddress: clientIP,
      additionalData: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
    
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  } finally {
    logApiRequest('POST', '/api/chat-stream', httpStatus, Date.now() - startTime, {
      userId: userId || undefined,
      ipAddress: clientIP
    });
  }
}