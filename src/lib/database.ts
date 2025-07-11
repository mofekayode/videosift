import { supabase, supabaseAdmin } from './supabase';
import { User, Video, Channel, VideoChunk, ChannelQueue } from '@/types';

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
export async function getVideoTranscript(videoId: string): Promise<Array<{
  id: string;
  text: string;
  start_sec: number;
  end_sec: number;
}>> {
  try {
    const { data, error } = await supabase
      .from('video_chunks')
      .select('id, text, start_sec, end_sec')
      .eq('video_id', videoId)
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