import { supabase, supabaseAdmin } from './supabase';
import { User, Video, Channel, VideoChunk, ChannelQueue, ChatSession, ChatMessage } from '@/types';

// User operations
export async function createUser(clerkId: string, email: string): Promise<User | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert([{ clerk_id: clerkId, email }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
}

export async function getUserByClerkId(clerkId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', clerkId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

// Video operations
export async function createVideo(video: Omit<Video, 'id' | 'created_at'>): Promise<Video | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('videos')
      .insert([video])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating video:', error);
    return null;
  }
}

export async function getVideoByYouTubeId(youtubeId: string): Promise<Video | null> {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('youtube_id', youtubeId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching video:', error);
    return null;
  }
}

export async function updateVideoTranscriptStatus(videoId: string, cached: boolean): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('videos')
      .update({ transcript_cached: cached })
      .eq('id', videoId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating video transcript status:', error);
    return false;
  }
}

// Video chunk operations
export async function createVideoChunks(chunks: Omit<VideoChunk, 'id' | 'created_at'>[]): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('video_chunks')
      .insert(chunks);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error creating video chunks:', error);
    return false;
  }
}

// Quick version - creates chunks without embeddings for immediate chat access
export async function createVideoChunksQuick(chunks: Array<{
  video_id: string;
  channel_id?: string;
  start_sec: number;
  end_sec: number;
  text: string;
  embedding: null;
}>): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('video_chunks')
      .insert(chunks);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error creating quick video chunks:', error);
    return false;
  }
}

// Get chunks for a video (used for background embedding processing)
export async function getVideoChunks(videoId: string): Promise<Array<{
  id: string;
  text: string;
  embedding: number[] | null;
}>> {
  try {
    const { data, error } = await supabase
      .from('video_chunks')
      .select('id, text, embedding')
      .eq('video_id', videoId);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching video chunks:', error);
    return [];
  }
}

// Update a chunk with its embedding
export async function updateVideoChunkEmbedding(chunkId: string, embedding: number[]): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('video_chunks')
      .update({ embedding })
      .eq('id', chunkId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating chunk embedding:', error);
    return false;
  }
}

// Simple function to get all transcript chunks for a video (no embeddings)
export async function getVideoTranscript(youtubeId: string): Promise<Array<{
  id: string;
  text: string;
  start_sec: number;
  end_sec: number;
}>> {
  try {
    // First, get the video record by YouTube ID
    const video = await getVideoByYouTubeId(youtubeId);
    if (!video) {
      console.log(`Video not found for YouTube ID: ${youtubeId}`);
      return [];
    }

    // Then get the transcript chunks using the internal video ID
    const { data, error } = await supabase
      .from('video_chunks')
      .select('id, text, start_sec, end_sec')
      .eq('video_id', video.id)
      .order('start_sec', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching video transcript:', error);
    return [];
  }
}

export async function searchVideoChunks(
  videoId: string,
  embedding: number[],
  limit: number = 20
): Promise<VideoChunk[]> {
  try {
    console.log(`🔍 Searching video chunks for videoId: ${videoId}, embedding length: ${embedding.length}`);
    
    // First, let's try a simple query to get ALL chunks for this video to test
    const { data: allChunks, error: simpleError } = await supabase
      .from('video_chunks')
      .select('*')
      .eq('video_id', videoId)
      .limit(limit);
    
    if (simpleError) {
      console.error('Simple query error:', simpleError);
    } else {
      console.log(`📊 Simple query found ${allChunks?.length || 0} chunks for videoId: ${videoId}`);
    }
    
    // Try the RPC function
    const { data, error } = await supabase.rpc('search_video_chunks', {
      video_id: videoId,
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: limit
    });
    
    if (error) {
      console.error('Supabase RPC error:', error);
      console.log('🔄 Falling back to simple search without embeddings...');
      // Fallback to simple search if RPC fails
      return allChunks || [];
    }
    
    console.log(`📊 RPC search found ${data?.length || 0} chunks`);
    return data || [];
  } catch (error) {
    console.error('Error searching video chunks:', error);
    return [];
  }
}

export async function searchChannelChunks(
  channelId: string,
  embedding: number[],
  limit: number = 20
): Promise<VideoChunk[]> {
  try {
    const { data, error } = await supabase.rpc('search_channel_chunks', {
      channel_id: channelId,
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: limit
    });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error searching channel chunks:', error);
    return [];
  }
}

// Channel operations
export async function createChannel(channel: Omit<Channel, 'id' | 'created_at'>): Promise<Channel | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('channels')
      .insert([channel])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating channel:', error);
    return null;
  }
}

export async function getUserChannels(userId: string): Promise<Channel[]> {
  try {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user channels:', error);
    return [];
  }
}

// Channel queue operations
export async function queueChannel(
  channelId: string,
  requestedBy: string
): Promise<ChannelQueue | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('channel_queue')
      .insert([{
        channel_id: channelId,
        requested_by: requestedBy,
        status: 'pending'
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error queueing channel:', error);
    return null;
  }
}

export async function getQueueStatus(channelId: string): Promise<ChannelQueue | null> {
  try {
    const { data, error } = await supabase
      .from('channel_queue')
      .select('*')
      .eq('channel_id', channelId)
      .order('requested_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching queue status:', error);
    return null;
  }
}

export async function getPendingChannels(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('channel_queue')
      .select(`
        *,
        channels (
          id,
          youtube_channel_id,
          title,
          status
        )
      `)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching pending channels:', error);
    return [];
  }
}

export async function updateChannelStatus(channelId: string, status: string, videoCount?: number): Promise<boolean> {
  try {
    const updateData: any = { 
      status,
      last_indexed_at: new Date().toISOString()
    };
    
    if (videoCount !== undefined) {
      updateData.video_count = videoCount;
    }
    
    const { error } = await supabaseAdmin
      .from('channels')
      .update(updateData)
      .eq('id', channelId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating channel status:', error);
    return false;
  }
}

export async function updateQueueItemStatus(
  queueId: string, 
  status: string, 
  videosProcessed?: number, 
  errorMessage?: string
): Promise<boolean> {
  try {
    const updateData: any = { 
      status,
      [status === 'processing' ? 'started_at' : 'completed_at']: new Date().toISOString()
    };
    
    if (videosProcessed !== undefined) {
      updateData.videos_processed = videosProcessed;
    }
    
    if (errorMessage) {
      updateData.error_message = errorMessage;
    }
    
    const { error } = await supabaseAdmin
      .from('channel_queue')
      .update(updateData)
      .eq('id', queueId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating queue item status:', error);
    return false;
  }
}

// Chat session operations
export async function createChatSession(videoId: string, userId?: string, anonId?: string): Promise<ChatSession | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .insert([{
        video_id: videoId,
        user_id: userId || null,
        anon_id: anonId || null
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating chat session:', error);
    return null;
  }
}

export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching chat session:', error);
    return null;
  }
}

export async function getChatSessionByAnonId(videoId: string, anonId: string): Promise<ChatSession | null> {
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('video_id', videoId)
      .eq('anon_id', anonId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching chat session by anon_id:', error);
    return null;
  }
}

export async function getChatMessagesBySession(sessionId: string): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return [];
  }
}

export async function saveChatMessage(sessionId: string, role: 'user' | 'assistant', content: string, citations?: any[]): Promise<ChatMessage | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert([{
        session_id: sessionId,
        role,
        content,
        citations: citations || null
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving chat message:', error);
    return null;
  }
}

export async function getChatMessageCount(sessionId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);
    
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting chat message count:', error);
    return 0;
  }
}

export async function updateChatSessionTimestamp(sessionId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error updating chat session timestamp:', error);
  }
}

export async function migrateAnonSessionToUser(anonId: string, userId: string): Promise<number> {
  try {
    // First get the count of sessions that will be migrated
    const { count: sessionsToMigrate } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('anon_id', anonId)
      .is('user_id', null);

    if (sessionsToMigrate === 0) {
      return 0;
    }

    // Then perform the migration
    const { error } = await supabaseAdmin
      .from('chat_sessions')
      .update({ 
        user_id: userId,
        anon_id: null // Clear the anon_id since it's now linked to a user
      })
      .eq('anon_id', anonId)
      .is('user_id', null); // Only migrate sessions that aren't already linked to a user
    
    if (error) throw error;
    
    console.log(`✅ Migrated ${sessionsToMigrate || 0} anonymous sessions to user ${userId}`);
    return sessionsToMigrate || 0;
  } catch (error) {
    console.error('Error migrating anon session to user:', error);
    return 0;
  }
}

export async function getUserChatSessions(userId: string): Promise<Array<{
  id: string;
  video_id: string;
  created_at: string;
  updated_at: string;
  video?: {
    youtube_id: string;
    title: string;
    thumbnail_url: string;
  };
  messageCount: number;
}>> {
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select(`
        id,
        video_id,
        created_at,
        updated_at,
        videos (
          youtube_id,
          title,
          thumbnail_url
        )
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    // Get message counts for each session
    const sessionsWithCounts = await Promise.all(
      (data || []).map(async (session) => {
        const messageCount = await getChatMessageCount(session.id);
        return {
          ...session,
          video: session.videos,
          messageCount
        };
      })
    );
    
    return sessionsWithCounts;
  } catch (error) {
    console.error('Error fetching user chat sessions:', error);
    return [];
  }
}