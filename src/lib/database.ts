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

export async function searchVideoChunks(
  videoId: string,
  embedding: number[],
  limit: number = 20
): Promise<VideoChunk[]> {
  try {
    const { data, error } = await supabase.rpc('search_video_chunks', {
      video_id: videoId,
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: limit
    });
    
    if (error) throw error;
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