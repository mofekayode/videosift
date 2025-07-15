import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ensureUserExists } from '@/lib/user-sync';
import { OpenAI } from 'openai';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { hybridChunkSearch } from '@/lib/rag-search';
import { filterChunksByContent, balanceChunksByVideo } from '@/lib/post-retrieval-filter';
import { checkRateLimit, incrementRateLimit, getUserTier, getClientIP } from '@/lib/rate-limit';
import { createChatSession, saveChatMessage, getChatMessageCount, getChatMessagesBySession } from '@/lib/database';
import { trackApiError } from '@/lib/error-tracking';
import { logger, LogCategory, logApiRequest } from '@/lib/logger';

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
    logger.info(LogCategory.API, 'Channel chat stream request started', {
      apiEndpoint: '/api/chat-channel-stream',
      ipAddress: clientIP
    });
    
    const { channelId, message, sessionId, anonId } = await request.json();
    
    console.log('📨 Channel chat request:', { channelId, message: message?.substring(0, 50), sessionId, anonId });
    
    if (!channelId || !message) {
      httpStatus = 400;
      return NextResponse.json(
        { error: 'Channel ID and message are required' },
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
    
    // Rate limiting check
    const identifier = supabaseUserId || clientIP;
    const tier = getUserTier(userId ?? undefined);
    
    let hourlyLimit, dailyLimit;
    try {
      [hourlyLimit, dailyLimit] = await Promise.all([
        checkRateLimit(identifier, 'chat', tier, 'hour'),
        checkRateLimit(identifier, 'chat', tier, 'day')
      ]);
    } catch (rateLimitError) {
      console.error('Rate limit check failed:', rateLimitError);
      hourlyLimit = { allowed: true, limit: 30, remaining: 29, resetTime: new Date(Date.now() + 3600000) };
      dailyLimit = { allowed: true, limit: 30, remaining: 29, resetTime: new Date(Date.now() + 86400000) };
    }
    
    if (!hourlyLimit.allowed || !dailyLimit.allowed) {
      httpStatus = 429;
      const limit = !hourlyLimit.allowed ? hourlyLimit : dailyLimit;
      return NextResponse.json({
        error: `Rate limit exceeded. You can send ${limit.limit} messages per ${!hourlyLimit.allowed ? 'hour' : 'day'}.`,
        rateLimited: true,
        limit: limit.limit,
        remaining: limit.remaining,
        resetTime: limit.resetTime,
        retryAfter: limit.retryAfter
      }, { status: 429 });
    }
    
    // Get channel info
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('*')
      .eq('id', channelId)
      .single();
    
    if (channelError || !channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }
    
    // Check if channel is processed
    if (channel.status !== 'ready') {
      return NextResponse.json(
        { error: 'Channel is still being processed. Please wait for processing to complete.' },
        { status: 503 }
      );
    }
    
    // Handle chat session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      try {
        const session = await createChatSession(
          supabaseUserId || undefined, 
          anonId, 
          channelId,  // Pass channel ID instead of video IDs
          undefined   // No specific video IDs for channel chat
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
    
    // Get all videos from this channel
    // Note: videos.channel_id references channels.id, not youtube_channel_id
    const { data: channelVideos, error: videosError } = await supabaseAdmin
      .from('videos')
      .select('id, title, youtube_id')
      .eq('channel_id', channelId)
      .eq('chunks_processed', true);
    
    if (videosError || !channelVideos || channelVideos.length === 0) {
      return NextResponse.json(
        { error: 'No processed videos found for this channel' },
        { status: 404 }
      );
    }
    
    console.log(`📺 Found ${channelVideos.length} processed videos for channel`);
    
    // Search across all videos in the channel in parallel
    // Get more chunks per video to ensure we find all relevant content
    const chunksPerVideo = 10; // Get 10 chunks from each video to better find specific content
    
    // Search all videos in parallel for better performance
    const searchPromises = channelVideos.map(async (video: any) => {
      try {
        const chunks = await hybridChunkSearch(video.id as string, message, chunksPerVideo);
        
        // Add video context to each chunk
        return chunks.map(chunk => ({
          ...chunk,
          video_title: video.title,
          video_youtube_id: video.youtube_id
        }));
      } catch (error) {
        console.error(`Error searching video ${video.id}:`, error);
        return [];
      }
    });
    
    // Wait for all searches to complete
    const searchResults = await Promise.all(searchPromises);
    const allRelevantChunks = searchResults.flat();
    
    // Apply post-retrieval filtering to better match content
    const filteredChunks = filterChunksByContent(allRelevantChunks, message);
    
    // Balance chunks across videos to ensure good coverage
    const topChunks = balanceChunksByVideo(filteredChunks, 5, 30);
    
    console.log(`📦 Retrieved ${topChunks.length} relevant chunks across ${channelVideos.length} videos`);
    console.log(`🎯 Top chunk scores: ${topChunks.slice(0, 3).map(c => (c.finalScore || c.similarity || 0).toFixed(3)).join(', ')}`);
    
    if (topChunks.length === 0) {
      return NextResponse.json(
        { error: 'No relevant content found in this channel' },
        { status: 404 }
      );
    }
    
    // Build context from chunks, grouped by video
    // Also create a mapping of timestamps to videos
    const timestampToVideo: Record<string, { videoId: string; title: string }> = {};
    
    const videoGroups = topChunks.reduce((acc, chunk) => {
      const videoKey = chunk.video_youtube_id;
      if (!acc[videoKey]) {
        acc[videoKey] = {
          title: chunk.video_title,
          chunks: []
        };
      }
      acc[videoKey].chunks.push(chunk.text || '');
      
      // Extract timestamps from this chunk and map them to the video
      const timestampRegex = /\[(\d{1,3}:\d{2}(?::\d{2})?)(?:\s*-\s*(\d{1,3}:\d{2}(?::\d{2})?))?\]/g;
      let match;
      while ((match = timestampRegex.exec(chunk.text || '')) !== null) {
        const timestamp = match[1];
        timestampToVideo[timestamp] = {
          videoId: chunk.video_youtube_id,
          title: chunk.video_title
        };
      }
      
      return acc;
    }, {} as Record<string, { title: string; chunks: string[] }>);
    
    // Format context with video titles
    const context = Object.entries(videoGroups)
      .map(([youtubeId, { title, chunks }]) => {
        return `**Video: ${title}**\n\n${chunks.join('\n\n')}`;
      })
      .join('\n\n---\n\n');
    
    // Create chat completion
    // Create a mapping of video titles to YouTube IDs for citation formatting
    const videoIdMap = Object.entries(videoGroups).reduce((acc, [youtubeId, { title }]) => {
      acc[title] = youtubeId;
      return acc;
    }, {} as Record<string, string>);

    const systemPrompt = `You are an AI assistant with comprehensive knowledge of this YouTube channel's content. You have watched and analyzed every video in this channel, understanding not just what was said, but the visual context, demonstrations, and nuances of each video.

CRITICAL RULES FOR CITATIONS:
1. ALWAYS use timestamps when referencing specific moments: [MM:SS] or [M:SS]
2. Use the EXACT timestamps from the video segments you're referencing
3. Mention which video the information comes from naturally in your response
4. Never make up or guess timestamps
5. DO NOT use generic ranges like [0:00 - 3:27] - be SPECIFIC
6. Only cite the actual moment where the information appears
7. Avoid lazy citations like bare "[0:00]" - but DO cite early moments if specific information appears there
8. If you can't pinpoint when something was shown or discussed, don't make the claim

IMPORTANT: When users ask for specific data, statistics, or numbers:
- Carefully scan ALL provided video segments for the exact information
- If the data is present, cite it with the specific timestamp and video
- NEVER say information isn't in the videos without thoroughly checking all segments
- Look for numbers, statistics, and data points throughout all videos

CRITICAL: When users ask about specific people, topics, or events:
- Search THOROUGHLY across ALL videos in the channel
- Even if you don't find information in the first few segments, keep looking
- Check every video that might contain relevant information
- If someone or something is mentioned in ANY video, you should find it
- IMPORTANT: Look for exact name matches - if a user asks about "Hussein Farhat", look for videos and segments that specifically mention "Hussein Farhat"
- Pay special attention to video titles - if a video is titled with a person's name, that video likely contains significant content about them

When answering:
- Speak as if you've watched these videos, not read transcripts
- Reference what you "saw" or what was "shown" in the videos
- Cite specific moments with timestamps
- Naturally mention which video when switching between them
- Focus on answering the user's question with insights from the videos

GOOD citation examples:
- "The creator demonstrates at [2:45] how to..."
- "In the video about X, you can see at [1:23:45] that..."
- "This is explained really well at [5:12] where they show..."

BAD citation examples (NEVER DO THIS):
- "[0:00 - 3:27]" (too broad)
- "[0:00]" (lazy citation without context)
- "The transcript mentions..." (never say transcript!)

Videos in this channel:
${Object.entries(videoGroups).map(([id, { title }]) => `- ${title}`).join('\n')}

Video content and moments:

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
        { role: 'user', content: `${message}\n\nPlease reference specific videos and timestamps when answering.` }
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: 1000, // Slightly increased to allow for better responses
    });
    
    // Increment rate limit
    try {
      await Promise.all([
        incrementRateLimit(identifier, 'chat', 'hour'),
        incrementRateLimit(identifier, 'chat', 'day')
      ]);
    } catch (error) {
      console.error('Failed to increment rate limit:', error);
    }
    
    // Save initial user message
    if (!currentSessionId.startsWith('temp_')) {
      try {
        await saveChatMessage(currentSessionId, 'user', message);
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
    
    // Get updated rate limit info
    let updatedHourlyLimit, updatedDailyLimit;
    try {
      [updatedHourlyLimit, updatedDailyLimit] = await Promise.all([
        checkRateLimit(identifier, 'chat', tier, 'hour'),
        checkRateLimit(identifier, 'chat', tier, 'day')
      ]);
    } catch (error) {
      updatedHourlyLimit = hourlyLimit;
      updatedDailyLimit = dailyLimit;
    }
    
    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Session-ID': currentSessionId,
        'X-Channel-Title': encodeURIComponent(channel.title), // Encode to handle Unicode characters
        'X-RateLimit-Limit-Hourly': updatedHourlyLimit.limit.toString(),
        'X-RateLimit-Remaining-Hourly': updatedHourlyLimit.remaining.toString(),
        'X-RateLimit-Reset-Hourly': Math.floor(updatedHourlyLimit.resetTime.getTime() / 1000).toString(),
        'X-RateLimit-Limit-Daily': updatedDailyLimit.limit.toString(),
        'X-RateLimit-Remaining-Daily': updatedDailyLimit.remaining.toString(),
        'X-RateLimit-Reset-Daily': Math.floor(updatedDailyLimit.resetTime.getTime() / 1000).toString(),
        'X-Video-Mapping': encodeURIComponent(JSON.stringify(timestampToVideo)) // Encode JSON as well
      },
    });
    
  } catch (error) {
    httpStatus = 500;
    console.error('Channel chat stream error:', error);
    
    trackApiError('Channel chat stream API error', {
      userId: userId || undefined,
      apiEndpoint: '/api/chat-channel-stream',
      ipAddress: clientIP,
      additionalData: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
    
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  } finally {
    logApiRequest('POST', '/api/chat-channel-stream', httpStatus, Date.now() - startTime, {
      userId: userId || undefined,
      ipAddress: clientIP
    });
  }
}