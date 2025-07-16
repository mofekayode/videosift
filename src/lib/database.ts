import { supabase, supabaseAdmin } from './supabase';
import { User, Video, Channel, VideoChunk, ChannelQueue, ChatSession, ChatMessage } from '@/types';

// Channel operations with OpenAI Assistant
export async function updateChannelAssistant(
  channelId: string, 
  assistantId: string, 
  vectorStoreId: string
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('channels')
      .update({ 
        assistant_id: assistantId,
        vector_store_id: vectorStoreId
      })
      .eq('id', channelId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating channel assistant:', error);
    return false;
  }
}

export async function getChannelVideosWithTranscripts(channelId: string) {
  try {
    const { data: videos, error } = await supabase
      .from('videos')
      .select('youtube_id, title, transcript')
      .eq('channel_id', channelId)
      .not('transcript', 'is', null);
    
    if (error) throw error;
    return videos;
  } catch (error) {
    console.error('Error fetching channel videos with transcripts:', error);
    return [];
  }
}

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
    
    if (error) {
      console.error('Error creating video:', error);
      // If it's a duplicate key error, return null so caller can handle it
      if (error.code === '23505') {
        console.log('⚠️ Video already exists with youtube_id:', video.youtube_id);
        return null;
      }
      throw error;
    }
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

// Video chunk operations - DEPRECATED: Using OpenAI vector stores instead
// export async function createVideoChunks(chunks: Omit<VideoChunk, 'id' | 'created_at'>[]): Promise<boolean> {
//   try {
//     const { error } = await supabaseAdmin
//       .from('video_chunks')
//       .insert(chunks);
//     
//     if (error) throw error;
//     return true;
//   } catch (error) {
//     console.error('Error creating video chunks:', error);
//     return false;
//   }
// }

// Quick version - creates chunks without embeddings for immediate chat access - DEPRECATED
// export async function createVideoChunksQuick(chunks: Array<{
//   video_id: string;
//   channel_id?: string;
//   start_sec: number;
//   end_sec: number;
//   text: string;
//   embedding: null;
// }>): Promise<boolean> {
//   try {
//     const { error } = await supabaseAdmin
//       .from('video_chunks')
//       .insert(chunks);
//     
//     if (error) throw error;
//     return true;
//   } catch (error) {
//     console.error('Error creating quick video chunks:', error);
//     return false;
//   }
// }

// Get chunks for a video (used for background embedding processing) - DEPRECATED
// export async function getVideoChunks(videoId: string): Promise<Array<{
//   id: string;
//   text: string;
//   embedding: number[] | null;
// }>> {
//   try {
//     const { data, error } = await supabase
//       .from('video_chunks')
//       .select('id, text, embedding')
//       .eq('video_id', videoId);
//     
//     if (error) throw error;
//     return data || [];
//   } catch (error) {
//     console.error('Error fetching video chunks:', error);
//     return [];
//   }
// }

// Update a chunk with its embedding - DEPRECATED
// export async function updateVideoChunkEmbedding(chunkId: string, embedding: number[]): Promise<boolean> {
//   try {
//     const { error } = await supabaseAdmin
//       .from('video_chunks')
//       .update({ embedding })
//       .eq('id', chunkId);
//     
//     if (error) throw error;
//     return true;
//   } catch (error) {
//     console.error('Error updating chunk embedding:', error);
//     return false;
//   }
// }

// Simple function to get all transcript chunks for a video (no embeddings) - DEPRECATED: Use vector stores
// export async function getVideoTranscript(youtubeId: string): Promise<Array<{
//   id: string;
//   text: string;
//   start_sec: number;
//   end_sec: number;
// }>> {
//   try {
//     // First, get the video record by YouTube ID
//     const video = await getVideoByYouTubeId(youtubeId);
//     if (!video) {
//       console.log(`Video not found for YouTube ID: ${youtubeId}`);
//       return [];
//     }

//     // Then get the transcript chunks using the internal video ID
//     const { data, error } = await supabase
//       .from('video_chunks')
//       .select('id, text, start_sec, end_sec')
//       .eq('video_id', video.id)
//       .order('start_sec', { ascending: true });
//     
//     if (error) throw error;
//     return data || [];
//   } catch (error) {
//     console.error('Error fetching video transcript:', error);
//     return [];
//   }
// }

// export async function searchVideoChunks(
//   videoId: string,
//   embedding: number[],
//   limit: number = 20
// ): Promise<VideoChunk[]> {
//   try {
//     console.log(`🔍 Searching video chunks for videoId: ${videoId}, embedding length: ${embedding.length}`);
//     
//     // First, let's try a simple query to get ALL chunks for this video to test
//     const { data: allChunks, error: simpleError } = await supabase
//       .from('video_chunks')
//       .select('*')
//       .eq('video_id', videoId)
//       .limit(limit);
//     
//     if (simpleError) {
//       console.error('Simple query error:', simpleError);
//     } else {
//       console.log(`📊 Simple query found ${allChunks?.length || 0} chunks for videoId: ${videoId}`);
//     }
//     
//     // Try the RPC function
//     const { data, error } = await supabase.rpc('search_video_chunks', {
//       video_id: videoId,
//       query_embedding: embedding,
//       match_threshold: 0.7,
//       match_count: limit
//     });
//     
//     if (error) {
//       console.error('Supabase RPC error:', error);
//       console.log('🔄 Falling back to simple search without embeddings...');
//       // Fallback to simple search if RPC fails
//       return allChunks || [];
//     }
//     
//     console.log(`📊 RPC search found ${data?.length || 0} chunks`);
//     return data || [];
//   } catch (error) {
//     console.error('Error searching video chunks:', error);
//     return [];
//   }
// }

// export async function searchChannelChunks(
//   channelId: string,
//   embedding: number[],
//   limit: number = 20
// ): Promise<VideoChunk[]> {
//   try {
//     const { data, error } = await supabase.rpc('search_channel_chunks', {
//       channel_id: channelId,
//       query_embedding: embedding,
//       match_threshold: 0.7,
//       match_count: limit
//     });
//     
//     if (error) throw error;
//     return data || [];
//   } catch (error) {
//     console.error('Error searching channel chunks:', error);
//     return [];
//   }
// }

// Channel operations
export async function createChannel(channel: Omit<Channel, 'id' | 'created_at'>): Promise<Channel | null> {
  try {
    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      console.error('Supabase admin client not available');
      return null;
    }

    // Check if channel already exists (regardless of owner)
    const { data: existingChannel } = await supabaseAdmin
      .from('channels')
      .select('*')
      .eq('youtube_channel_id', channel.youtube_channel_id)
      .single();

    if (existingChannel) {
      console.log('Channel already exists:', existingChannel);
      // Return the existing channel - multiple users can process the same channel
      // The channel processor will skip already processed videos
      return existingChannel;
    }

    // Channel doesn't exist, create it with the first user as owner
    // Other users can still access it via channel_queue
    const { data, error } = await supabaseAdmin
      .from('channels')
      .insert([channel])  // Use the owner_user_id from the channel parameter
      .select()
      .single();
    
    if (error) {
      console.error('Detailed error creating channel:', {
        error,
        channel,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error creating channel:', error);
    return null;
  }
}

export async function getUserChannels(userId: string): Promise<Channel[]> {
  try {
    // Get channels that the user either owns OR has access to through channel_queue
    // First, get channels the user owns
    const { data: ownedChannels, error: ownedError } = await supabase
      .from('channels')
      .select(`
        *,
        videos:videos_channel_id_fkey (
          id,
          youtube_id,
          title,
          thumbnail_url,
          duration,
          chunks_processed,
          transcript_cached
        ),
        channel_queue:channel_queue_channel_id_fkey (*)
      `)
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: false });
    
    if (ownedError) throw ownedError;
    
    // Then, get channels the user has access to via channel_queue
    const { data: queuedChannels, error: queueError } = await supabase
      .from('channel_queue')
      .select('channel_id')
      .eq('requested_by', userId);
    
    if (queueError) throw queueError;
    
    // If user has queued channels, fetch those too
    let accessedChannels: Channel[] = [];
    if (queuedChannels && queuedChannels.length > 0) {
      const queuedChannelIds = queuedChannels.map(q => q.channel_id);
      
      const { data: accessData, error: accessError } = await supabase
        .from('channels')
        .select(`
          *,
          videos:videos_channel_id_fkey (
            id,
            youtube_id,
            title,
            thumbnail_url,
            duration,
            chunks_processed
          ),
          channel_queue:channel_queue_channel_id_fkey (*)
        `)
        .in('id', queuedChannelIds)
        .order('created_at', { ascending: false });
      
      if (accessError) throw accessError;
      accessedChannels = accessData || [];
    }
    
    // Combine and deduplicate channels
    const allChannels = [...(ownedChannels || []), ...accessedChannels];
    const uniqueChannels = Array.from(
      new Map(allChannels.map(channel => [channel.id, channel])).values()
    );
    
    return uniqueChannels;
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
    console.log('🔄 Queueing channel:', { channelId, requestedBy });
    
    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not available for queueChannel');
      return null;
    }
    
    // First check if queue entry already exists for this user and channel
    const { data: existingQueue, error: checkError } = await supabaseAdmin
      .from('channel_queue')
      .select('*')
      .eq('channel_id', channelId)
      .eq('requested_by', requestedBy)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is expected
      console.error('❌ Error checking existing queue:', checkError);
      throw checkError;
    }
    
    if (existingQueue) {
      console.log('✅ Queue entry already exists for user and channel:', existingQueue);
      return existingQueue;
    }
    
    // Create new queue entry
    console.log('📝 Creating new queue entry...');
    const { data, error } = await supabaseAdmin
      .from('channel_queue')
      .insert([{
        channel_id: channelId,
        requested_by: requestedBy,
        status: 'pending'
      }])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating queue entry:', error);
      throw error;
    }
    
    console.log('✅ Queue entry created successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Error queueing channel:', error);
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
export async function createChatSession(
  userId?: string, 
  anonId?: string, 
  channelId?: string,
  videoIds?: string[],
  deviceInfo?: {
    deviceFingerprint?: string;
    clientIp?: string;
    userAgent?: string;
  }
): Promise<ChatSession | null> {
  console.log('📝 Creating chat session with data:', {
    user_id: userId,
    anon_id: anonId,
    video_id: videoIds?.[0]
  });
  
  const sessionData: any = {
    user_id: userId || null,
    anon_id: anonId || null
  };
  
  // Add device tracking info if provided
  if (deviceInfo) {
    if (deviceInfo.deviceFingerprint) {
      sessionData.device_fingerprint = deviceInfo.deviceFingerprint;
    }
    if (deviceInfo.clientIp) {
      sessionData.client_ip = deviceInfo.clientIp;
    }
    if (deviceInfo.userAgent) {
      sessionData.user_agent = deviceInfo.userAgent;
    }
  }
  
  try {
    // Handle different session types
    if (channelId) {
      // For now, skip channel_id until migration is applied
      console.log('📝 Channel chat session requested - using temporary session');
      // Generate a proper temporary ID that won't be saved to database
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      // Return a temporary session for channels until we have channel_id column
      return {
        id: tempId,
        user_id: userId || null,
        anon_id: anonId || null,
        video_id: null,
        video_ids: null,
        created_at: new Date().toISOString(),
        device_fingerprint: deviceInfo?.deviceFingerprint || null,
        client_ip: deviceInfo?.clientIp || null,
        user_agent: deviceInfo?.userAgent || null
      };
    } else if (videoIds && videoIds.length === 1) {
      // Single video chat
      sessionData.video_id = videoIds[0];
    } else if (videoIds && videoIds.length > 1) {
      // Multi-video chat - store as JSON
      sessionData.video_ids = JSON.stringify(videoIds);
    }
    
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert([sessionData])
      .select()
      .single();
    
    if (error) throw error;
    console.log('✅ Chat session created:', data?.id);
    return data;
  } catch (error) {
    console.error('Error creating chat session:', error);
    console.error('Session data attempted:', sessionData);
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
    console.log('💬 Saving chat message:', { sessionId, role, contentLength: content.length });
    
    const { data, error } = await supabase
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
    console.log('✅ Chat message saved:', data?.id);
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
    // First get the sessions
    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    // Process each session to get video details and message counts
    const sessionsWithDetails = await Promise.all(
      (sessions || []).map(async (session) => {
        let video = null;
        
        if (session.video_id) {
          // First try to get video by UUID
          const { data: videoByUuid } = await supabase
            .from('videos')
            .select('youtube_id, title, thumbnail_url')
            .eq('id', session.video_id)
            .single();
          
          if (videoByUuid) {
            video = videoByUuid;
          } else {
            // If not found, try by YouTube ID (for legacy sessions)
            const { data: videoByYoutubeId } = await supabase
              .from('videos')
              .select('youtube_id, title, thumbnail_url')
              .eq('youtube_id', session.video_id)
              .single();
            
            video = videoByYoutubeId;
          }
        }
        
        const messageCount = await getChatMessageCount(session.id);
        
        return {
          ...session,
          video,
          messageCount
        };
      })
    );
    
    return sessionsWithDetails;
  } catch (error) {
    console.error('Error fetching user chat sessions:', error);
    return [];
  }
}