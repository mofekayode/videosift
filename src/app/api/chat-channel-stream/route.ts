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
import { logSearchCoverage } from '@/lib/debug-search';

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
    
    // Detect if this is a general channel query
    const isGeneralChannelQuery = /tell me about|all videos|what videos|channel content|channel overview|indexed so far/i.test(message);
    
    // Search across all videos in the channel in parallel
    // Get more chunks per video to ensure we find all relevant content
    const chunksPerVideo = isGeneralChannelQuery ? 2 : 10; // Less chunks per video for general queries to cover more videos
    
    // Search all videos in parallel for better performance
    const searchPromises = channelVideos.map(async (video: any) => {
      try {
        // Skip videos without youtube_id
        if (!video.youtube_id) {
          console.warn(`⚠️ Video ${video.title} (${video.id}) has no youtube_id`);
          return [];
        }
        
        const chunks = await hybridChunkSearch(video.id as string, video.youtube_id, message, chunksPerVideo);
        
        // Add video context to each chunk
        return chunks.map(chunk => ({
          ...chunk,
          video_title: video.title,
          video_youtube_id: video.youtube_id
        }));
      } catch (error) {
        console.error(`Error searching video ${video.title}:`, error);
        return [];
      }
    });
    
    // Wait for all searches to complete
    const searchResults = await Promise.all(searchPromises);
    const allRelevantChunks = searchResults.flat();
    
    // Apply post-retrieval filtering to better match content
    const filteredChunks = filterChunksByContent(allRelevantChunks, message);
    
    // Ensure chunks have the required properties for balanceChunksByVideo
    const typedChunks = filteredChunks.map(chunk => {
      return {
        ...chunk,
        video_youtube_id: chunk.video_youtube_id || '',
        video_title: chunk.video_title || ''
      };
    });
    
    // Balance chunks across videos to ensure good coverage
    // For general queries, prioritize coverage over depth
    const maxChunksPerVideo = isGeneralChannelQuery ? 2 : 3;
    const totalChunkLimit = isGeneralChannelQuery ? 60 : 50; // More chunks for general queries
    const topChunks = balanceChunksByVideo(typedChunks, maxChunksPerVideo, totalChunkLimit);
    
    // Debug logging for development
    if (process.env.NODE_ENV === 'development') {
      logSearchCoverage(channelVideos as any[], searchResults, topChunks);
    }
    
    // Log video coverage
    const uniqueVideosInContext = new Set(topChunks.map(c => c.video_youtube_id));
    console.log(`📦 Retrieved ${topChunks.length} chunks from ${uniqueVideosInContext.size}/${channelVideos.length} videos`);
    console.log(`🎯 Top chunk scores: ${topChunks.slice(0, 3).map(c => (c.finalScore || c.similarity || 0).toFixed(3)).join(', ')}`);
    console.log(`📹 Videos in context: ${Array.from(uniqueVideosInContext).length} videos`);
    
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
          chunks: [],
          timestamps: new Set<string>()
        };
      }
      
      // Store the chunk's time range for accurate timestamp mapping
      const startTime = Math.floor(chunk.start_time);
      const endTime = Math.floor(chunk.end_time);
      
      // Convert seconds to timestamp format
      const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
          return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
      };
      
      const chunkTimestamp = formatTime(startTime);
      acc[videoKey].timestamps.add(chunkTimestamp);
      
      // Always include timestamp with chunk text
      const chunkWithTimestamp = `[At ${chunkTimestamp}]: ${chunk.text || ''}`;
      acc[videoKey].chunks.push(chunkWithTimestamp);
      
      timestampToVideo[chunkTimestamp] = {
        videoId: chunk.video_youtube_id,
        title: chunk.video_title
      };
      
      return acc;
    }, {} as Record<string, { title: string; chunks: string[]; timestamps: Set<string> }>);
    
    // Format context with video titles and timestamps
    const context = Object.entries(videoGroups)
      .map(([youtubeId, group]) => {
        const typedGroup = group as { title: string; chunks: string[] };
        // Find video duration
        const video = channelVideos.find((v: any) => v.youtube_id === youtubeId) as any;
        const duration = video?.duration || 0;
        const durationStr = duration > 0 ? ` (Duration: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})` : '';
        
        return `**Video: ${typedGroup.title}${durationStr}**

${typedGroup.chunks.join('\n\n')}`;
      })
      .join('\n\n---\n\n');
    
    // Create a complete list of ALL videos in the channel for context
    const allVideosList = (channelVideos as Array<{ id: string; title: string; youtube_id: string; duration?: number }>).map(v => {
      const duration = v.duration || 0;
      const durationStr = duration > 0 ? ` (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})` : '';
      return `- ${v.title}${durationStr}`;
    }).join('\n');
    
    // Create chat completion
    // Create a mapping of video titles to YouTube IDs for citation formatting
    const videoIdMap = Object.entries(videoGroups).reduce((acc, [youtubeId, group]) => {
      const typedGroup = group as { title: string; chunks: string[] };
      acc[typedGroup.title] = youtubeId;
      return acc;
    }, {} as Record<string, string>);

    const systemPrompt = `You are an AI assistant with comprehensive knowledge of this YouTube channel's content. You have watched and analyzed every video in this channel, understanding not just what was said, but the visual context, demonstrations, and nuances of each video.

IMPORTANT: The timestamps in the video segments are marked as [At X:XX]. When you cite them, use the format [X:XX] "Video Title" with the video title in quotes. This allows users to click and go directly to that moment in the specific video.

CRITICAL RULES FOR CITATIONS:
1. ALWAYS provide citations when referencing video content - citations are ESSENTIAL
2. Look for timestamps marked as [At X:XX] in the segments and cite them as [X:XX]
3. Use MULTIPLE citations throughout your response - the more specific timestamps, the better
4. ONLY avoid [0:00] if it's being used generically - but DO cite [0:00] if something specific happens there
5. For example: "The video discusses X [0:00]" is BAD, but "The doctor introduces the topic at [0:00]" is GOOD
6. NEVER cite a timestamp beyond a video's duration (shown in parentheses)
7. Cite the EXACT timestamps from the segments - look for [At X:XX] markers
8. When discussing multiple points from a video, cite EACH specific moment
9. ALWAYS use format: [X:XX] "Video Title" - with quotes around the title
10. MORE citations are better than fewer - users want to know EXACTLY where information is

IMPORTANT: When users ask for specific data, statistics, or numbers:
- Carefully scan ALL provided video segments for the exact information
- If the data is present, cite it with the specific timestamp and video
- NEVER say information isn't in the videos without thoroughly checking all segments
- Look for numbers, statistics, and data points throughout all videos

CRITICAL: When users ask about "all videos" or "tell me about the channel":
- List ALL ${channelVideos.length} videos from the complete list above
- Provide a brief summary of each video based on available information
- If you don't have detailed segments for some videos, still acknowledge they exist
- NEVER claim you only have information about a subset of videos

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
- "The doctor explains the procedure at [2:45] and shows the results at [3:12]"
- "In 'Medical Emergencies', the explosion occurs at [1:06] followed by the response at [1:23]"
- "The supplement discussion starts at [0:45] with specific claims debunked at [2:15], [3:30], and [5:12]"
- "At [0:15], the host introduces the topic, then dives into details at [0:45]"

BAD citation examples (NEVER DO THIS):
- "The video discusses X [0:00]" - Generic use of [0:00] without specifics
- "[0:00 - 3:27]" - Too broad, not specific
- No citations at all - Users NEED timestamps to find information
- "[32:12]" for a 1:00 video - Impossible timestamp
- "The transcript mentions..." - Never say transcript!

REMEMBER: Citations are your PRIMARY VALUE - provide MANY specific timestamps!

ALL videos in this channel (${channelVideos.length} total):
${allVideosList}

IMPORTANT: The above list shows ALL videos in the channel. You have knowledge of all these videos, even if specific segments aren't included below. When users ask about the channel's content, acknowledge all videos exist.

Currently retrieved segments from these videos:
${Object.entries(videoGroups).map(([id, group]) => {
  const typedGroup = group as { title: string; chunks: string[] };
  return `- ${typedGroup.title}`;
}).join('\n')}

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
        { role: 'user', content: isGeneralChannelQuery 
          ? `${message}\n\nIMPORTANT: List ALL ${channelVideos.length} videos in the channel with brief descriptions. Use ACTUAL timestamps from the segments (marked as [At X:XX]) when citing specific moments. NEVER use [0:00] - if you don't have a specific timestamp, just mention the video without a citation.`
          : `${message}\n\nPlease reference specific videos and use ACTUAL timestamps from the segments when answering. NEVER cite [0:00] - if you don't have a specific timestamp for something, just mention the video title without a citation.` 
        }
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: 1500, // Increased to allow listing all videos when requested
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