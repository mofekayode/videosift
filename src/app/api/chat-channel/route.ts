import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/user-sync';
// TODO: Fix these imports - openai-assistant module doesn't exist
// Temporary implementations to fix build
const createVectorStore = async (name: string) => { throw new Error('createVectorStore not implemented'); };
const uploadChannelTranscripts = async (...args: any[]) => { throw new Error('uploadChannelTranscripts not implemented'); };
const createChannelAssistant = async (...args: any[]) => { throw new Error('createChannelAssistant not implemented'); };
const createThread = async () => { throw new Error('createThread not implemented'); };
const chatWithAssistant = async (...args: any[]) => { return { content: 'chatWithAssistant not implemented', citations: [] }; };
const generateChannelTranscriptContent = async (...args: any[]) => { throw new Error('generateChannelTranscriptContent not implemented'); };
import { 
  updateChannelAssistant, 
  getChannelVideosWithTranscripts,
  createChatSession,
  saveChatMessage,
  getChatMessageCount
} from '@/lib/database';

interface ChatRequest {
  channelId: string;
  message: string;
  sessionId?: string;
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
    const { channelId, message, sessionId }: ChatRequest = await request.json();
    
    if (!channelId || !message) {
      return NextResponse.json(
        { error: 'Channel ID and message are required' },
        { status: 400 }
      );
    }
    
    console.log('🔍 Channel chat request for:', channelId);
    
    // Get the Supabase user if authenticated
    let user = null;
    if (userId) {
      user = await ensureUserExists();
      if (!user) {
        return NextResponse.json(
          { error: 'Failed to sync user data' },
          { status: 500 }
        );
      }
    }
    
    // Get channel details first
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
    
    // Check if user has access to the channel via user_channels table
    if (user) {
      const { data: userChannelAccess, error: accessError } = await supabase
        .from('user_channels')
        .select('id')
        .eq('channel_id', channelId)
        .eq('user_id', user.id)
        .single();
      
      console.log('🔍 Access check:', { 
        channelId, 
        supabaseUserId: user?.id,
        clerkUserId: userId,
        hasAccess: !!userChannelAccess,
        accessError
      });
      
      if (accessError || !userChannelAccess) {
        console.error('User does not have access to this channel');
        console.error('Access check:', { channelId, userId: user.id, accessError });
        return NextResponse.json(
          { error: 'Channel not found or access denied' },
          { status: 404 }
        );
      }
    } else {
      // For anonymous users, deny access to channels
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    if (channel.status !== 'ready') {
      return NextResponse.json(
        { error: 'Channel is not ready for chat. Status: ' + channel.status },
        { status: 400 }
      );
    }
    
    // Initialize OpenAI Assistant if not exists
    let assistantId = channel.assistant_id;
    let vectorStoreId = channel.vector_store_id;
    
    if (!assistantId || !vectorStoreId) {
      console.log('🤖 Setting up OpenAI Assistant for channel:', channel.title);
      
      // Create vector store
      vectorStoreId = await createVectorStore(channel.title);
      
      // Get all videos with transcripts for this channel
      const videos = await getChannelVideosWithTranscripts(channelId);
      
      if (videos.length === 0) {
        return NextResponse.json(
          { error: 'No videos with transcripts found for this channel' },
          { status: 400 }
        );
      }
      
      // Generate combined transcript content
      const transcriptContent = generateChannelTranscriptContent(videos);
      
      // Upload transcripts to vector store
      await uploadChannelTranscripts(vectorStoreId, transcriptContent, channel.title);
      
      // Create assistant
      assistantId = await createChannelAssistant({
        name: `${channel.title} Chat Assistant`,
        instructions: `You are a helpful assistant that can answer questions about the YouTube channel "${channel.title}". 
        
You have access to transcripts from all videos in this channel. When answering questions:

1. Always include specific video references in your responses
2. Use timestamp citations in format [MM:SS] or [HH:MM:SS] when referencing specific moments
3. If discussing multiple videos, clearly separate the information by video
4. Provide direct quotes from transcripts when relevant
5. If you cannot find relevant information in the transcripts, say so clearly

Format your responses with proper citations and make them conversational and helpful.`,
        model: 'gpt-4o',
        vectorStoreId
      });
      
      // Update channel with assistant details
      await updateChannelAssistant(channelId, assistantId, vectorStoreId);
      
      console.log('✅ OpenAI Assistant setup complete');
    }
    
    // Create or get session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      // Convert userId from null to undefined if needed
      const userIdParam = user?.id || undefined;
      const newSession = await createChatSession(userIdParam, undefined, channelId);
      currentSessionId = newSession?.id;
      
      if (!currentSessionId) {
        throw new Error('Failed to create chat session');
      }
    }
    
    // Check message limits
    const messageCount = await getChatMessageCount(currentSessionId);
    const userLimit = userId ? CHAT_LIMITS.SIGNED_USER : CHAT_LIMITS.ANONYMOUS_USER;
    
    if (messageCount >= userLimit) {
      return NextResponse.json({
        error: `Chat limit reached. ${userId ? 'Signed users' : 'Anonymous users'} can send up to ${userLimit} messages per session.`,
        limitReached: true,
        messageCount,
        limit: userLimit
      }, { status: 429 });
    }
    
    // Create thread for this conversation (in production, you might want to persist threads)
    const threadId = await createThread();
    
    // Save user message
    await saveChatMessage(currentSessionId, 'user', message);
    
    // Get response from assistant
    console.log('💬 Sending message to OpenAI Assistant');
    const assistantResponse = await chatWithAssistant(assistantId, threadId, message);
    
    // Save assistant response
    await saveChatMessage(currentSessionId, 'assistant', assistantResponse.content);
    
    return NextResponse.json({
      response: assistantResponse.content,
      citations: assistantResponse.citations,
      sessionId: currentSessionId,
      messageCount: messageCount + 1,
      limit: userLimit,
      success: true
    });
    
  } catch (error) {
    console.error('❌ Error in channel chat:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}