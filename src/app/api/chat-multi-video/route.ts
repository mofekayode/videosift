import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { chatWithAssistant } from '@/lib/openai-assistant';
import { 
  createChatSession, 
  saveChatMessage, 
  getChatSessionMessageCount 
} from '@/lib/database';
import { ensureUserExists } from '@/lib/user-sync';

interface ChatRequest {
  videoIds: string[];
  message: string;
  sessionId?: string;
}

interface VideoSource {
  youtube_id: string;
  title: string;
  thumbnail_url?: string;
}

const CHAT_LIMITS = {
  ANONYMOUS_USER: 10,
  SIGNED_USER: 50,
  FREE_TIER: 50,
  PREMIUM_TIER: 200
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const { videoIds, message, sessionId }: ChatRequest = await request.json();
    
    // Get the Supabase user if authenticated
    let supabaseUserId = null;
    if (userId) {
      const user = await ensureUserExists();
      if (user) {
        supabaseUserId = user.id;
      }
    }
    
    if (!videoIds?.length || !message) {
      return NextResponse.json(
        { error: 'Video IDs and message are required' },
        { status: 400 }
      );
    }
    
    console.log('🔍 Multi-video chat request for videos:', videoIds);
    
    // Get video data for all videos
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('*')
      .in('youtube_id', videoIds);
    
    if (videosError || !videos?.length) {
      return NextResponse.json(
        { error: 'Videos not found in database' },
        { status: 404 }
      );
    }
    
    // Create video sources for response
    const videoSources: VideoSource[] = videos.map(video => ({
      youtube_id: video.youtube_id,
      title: video.title,
      thumbnail_url: video.thumbnail_url
    }));
    
    // Check if all videos have vector stores
    const videosWithoutVectorStore = videos.filter(v => !v.vector_store_id);
    if (videosWithoutVectorStore.length > 0) {
      console.warn('Some videos do not have vector stores:', videosWithoutVectorStore.map(v => v.youtube_id));
      return NextResponse.json(
        { error: 'Some videos are still being processed. Please try again later.' },
        { status: 503 }
      );
    }
    
    // Get all vector store IDs
    const vectorStoreIds = videos.map(v => v.vector_store_id).filter(Boolean);
    console.log('📊 Using vector stores:', vectorStoreIds);
    
    // Create or get session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const newSession = await createChatSession(supabaseUserId, null, null, videoIds);
      currentSessionId = newSession?.id;
      
      if (!currentSessionId) {
        throw new Error('Failed to create chat session');
      }
    }
    
    // Check message limits
    const messageCount = await getChatSessionMessageCount(currentSessionId);
    const userLimit = userId ? CHAT_LIMITS.SIGNED_USER : CHAT_LIMITS.ANONYMOUS_USER;
    
    if (messageCount >= userLimit) {
      return NextResponse.json({
        error: `Chat limit reached. ${userId ? 'Signed users' : 'Anonymous users'} can send up to ${userLimit} messages per session.`,
        limitReached: true,
        messageCount,
        limit: userLimit
      }, { status: 429 });
    }
    
    // Generate AI response using Assistant API with multiple vector stores
    let response;
    let citations;
    
    try {
      console.log('🤖 Using OpenAI Assistant API with multiple vector stores');
      
      const assistantResponse = await chatWithAssistant(
        message,
        vectorStoreIds, // Pass array of vector store IDs
        currentSessionId ? `thread_${currentSessionId}` : undefined
      );
      
      response = assistantResponse.response;
      citations = assistantResponse.citations;
      
      console.log('✅ Multi-video response generated');
      
    } catch (error) {
      console.error('❌ Assistant API error:', error);
      return NextResponse.json(
        { error: 'Failed to generate response' },
        { status: 500 }
      );
    }
    
    // Save messages to database
    try {
      await saveChatMessage(currentSessionId, 'user', message);
      await saveChatMessage(currentSessionId, 'assistant', response, citations);
    } catch (error) {
      console.log('⚠️ Failed to save chat messages:', error);
    }
    
    // Analyze which videos were referenced in the response
    // Since we don't have chunk-level attribution with vector stores,
    // we'll do simple title matching for now
    const referencedVideos = videoSources.filter(video => 
      response.toLowerCase().includes(video.title.toLowerCase())
    );
    
    return NextResponse.json({
      response,
      citations,
      videoSources,
      referencedVideos,
      sessionId: currentSessionId,
      messageCount: messageCount + 1,
      limit: userLimit,
      success: true
    });
    
  } catch (error) {
    console.error('❌ Error in multi-video chat:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}