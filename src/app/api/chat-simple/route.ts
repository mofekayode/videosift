import { NextRequest, NextResponse } from 'next/server';
import { generateChatResponse, extractCitations } from '@/lib/openai';
import { getVideoTranscript, createChatSession, saveChatMessage, getChatMessageCount } from '@/lib/database';
import { auth } from '@clerk/nextjs/server';

// Chat session limits
const CHAT_LIMITS = {
  ANONYMOUS_USER: 10, // 10 messages per session for anonymous users
  SIGNED_USER: 50,    // 50 messages per session for signed users
  FREE_TIER: 50,      // Same as signed user for now
  PREMIUM_TIER: 200   // Future premium tier
};

export async function POST(request: NextRequest) {
  try {
    const { query, videoId, messages = [], sessionId, anonId } = await request.json();
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    // Get user authentication
    const { userId } = await auth();
    
    // Handle chat session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      // Try to create new session, but don't fail if it doesn't work
      try {
        const session = await createChatSession(videoId, userId || undefined, anonId);
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

    return NextResponse.json({
      success: true,
      response,
      citations: citations.map(citation => ({
        timestamp: citation.timestamp,
        text: findChunkByTimestamp(transcriptChunks, citation.timestamp)?.text || '',
        video_id: videoId
      })),
      chunks_used: chunks.length,
      sessionId: currentSessionId,
      sessionInfo
    });
    
  } catch (error) {
    console.error('Simple chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
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