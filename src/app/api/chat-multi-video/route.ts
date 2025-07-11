import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { generateChatResponse } from '@/lib/openai';
import { extractCitations } from '@/lib/transcript';
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
    
    // Get transcripts for all videos
    const transcriptPromises = videos.map(async (video) => {
      const { data: transcript, error } = await supabase
        .from('video_chunks')
        .select('*')
        .eq('video_id', video.id)
        .order('start_sec', { ascending: true });
      
      if (error || !transcript) {
        console.warn(`No transcript found for video ${video.youtube_id}`);
        return [];
      }
      
      // Add video info to each chunk
      return transcript.map(chunk => ({
        text: chunk.text,
        start_sec: chunk.start_sec,
        end_sec: chunk.end_sec,
        video_title: video.title,
        video_youtube_id: video.youtube_id,
        video_thumbnail: video.thumbnail_url
      }));
    });
    
    const allTranscripts = await Promise.all(transcriptPromises);
    const transcriptChunks = allTranscripts.flat();
    
    console.log('📊 Found transcript chunks:', transcriptChunks.length);
    
    if (transcriptChunks.length === 0) {
      return NextResponse.json(
        { error: 'No transcripts found for the provided videos' },
        { status: 404 }
      );
    }
    
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
    
    // Generate AI response with multi-video context
    const response = await generateChatResponse(
      [{ role: 'user', content: message }],
      transcriptChunks,
      'gpt-4o'
    );
    
    if (!response) {
      return NextResponse.json(
        { error: 'Failed to generate response' },
        { status: 500 }
      );
    }
    
    // Extract citations from response
    const citations = extractCitations(response);
    
    // Save messages to database
    try {
      await saveChatMessage(currentSessionId, 'user', message);
      await saveChatMessage(currentSessionId, 'assistant', response, citations);
    } catch (error) {
      console.log('⚠️ Failed to save chat messages:', error);
    }
    
    // Analyze which videos were referenced in the response
    const referencedVideos = videoSources.filter(video => 
      response.toLowerCase().includes(video.title.toLowerCase()) ||
      transcriptChunks.some(chunk => 
        chunk.video_youtube_id === video.youtube_id && 
        citations.some(citation => response.includes(citation))
      )
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