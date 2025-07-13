import { supabaseAdmin } from '@/lib/supabase';
import { sendChannelProcessingNotification } from '@/lib/email';
import { processVideoTranscript } from '@/lib/process-video-transcript';

export interface ProcessChannelQueueResult {
  success: boolean;
  processed: number;
  channels?: Array<{
    channelId: string;
    title: string;
    videosProcessed: number;
    status: string;
    error?: string;
  }>;
  error?: string;
}

export async function processChannelQueue(): Promise<ProcessChannelQueueResult> {
  try {
    console.log('🔄 Processing channel queue...');
    
    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      console.log('⚠️ Supabase admin client not available - skipping channel queue processing');
      return { 
        success: false, 
        processed: 0, 
        error: 'Supabase admin client not available' 
      };
    }
    
    // Get pending channel queue items with user data
    const { data: queueItems, error: queueError } = await supabaseAdmin
      .from('channel_queue')
      .select(`
        *,
        channels (
          id,
          youtube_channel_id,
          title,
          status,
          users!channels_owner_user_id_fkey (
            id,
            email,
            clerk_id
          )
        )
      `)
      .eq('status', 'pending')
      .limit(5); // Process up to 5 channels at a time
    
    if (queueError) {
      console.error('❌ Error fetching queue items:', queueError);
      return { 
        success: false, 
        processed: 0, 
        error: 'Failed to fetch queue items' 
      };
    }
    
    if (!queueItems || queueItems.length === 0) {
      console.log('✅ No pending channels to process');
      return { success: true, processed: 0 };
    }
    
    console.log(`📋 Found ${queueItems.length} channels to process`);
    
    const processedChannels = [];
    
    for (const queueItem of queueItems) {
      try {
        // Mark queue item as processing
        await supabaseAdmin
          .from('channel_queue')
          .update({ status: 'processing', started_at: new Date().toISOString() })
          .eq('id', queueItem.id);
        
        // Mark channel as processing
        await supabaseAdmin
          .from('channels')
          .update({ status: 'processing' })
          .eq('id', queueItem.channel_id);
        
        console.log(`🚀 Processing channel: ${queueItem.channels.title}`);
        
        // Process the channel
        const result = await processChannelVideos(queueItem.channels, queueItem.id);
        
        if (result.success) {
          // Mark as completed
          await supabaseAdmin
            .from('channel_queue')
            .update({ 
              status: 'completed', 
              completed_at: new Date().toISOString(),
              videos_processed: result.videosProcessed,
              error_message: null
            })
            .eq('id', queueItem.id);
          
          await supabaseAdmin
            .from('channels')
            .update({ 
              status: 'ready',
              video_count: result.videosProcessed
            })
            .eq('id', queueItem.channel_id);
          
          console.log(`✅ Completed channel: ${queueItem.channels.title} (${result.videosProcessed} videos)`);
          
          // Send success email
          if (queueItem.channels.users?.email) {
            await sendChannelProcessingNotification({
              userEmail: queueItem.channels.users.email,
              userName: extractUserNameFromEmail(queueItem.channels.users.email),
              channelTitle: queueItem.channels.title,
              channelUrl: `https://youtube.com/channel/${queueItem.channels.youtube_channel_id}`,
              videosProcessed: result.videosProcessed,
              status: 'completed'
            }).catch(err => console.error('Failed to send email:', err));
          }
          
          processedChannels.push({
            channelId: queueItem.channel_id,
            title: queueItem.channels.title,
            videosProcessed: result.videosProcessed,
            status: 'completed'
          });
        } else {
          // Mark as failed
          await supabaseAdmin
            .from('channel_queue')
            .update({ 
              status: 'failed', 
              completed_at: new Date().toISOString(),
              error_message: result.error
            })
            .eq('id', queueItem.id);
          
          await supabaseAdmin
            .from('channels')
            .update({ status: 'failed' })
            .eq('id', queueItem.channel_id);
          
          console.error(`❌ Failed channel: ${queueItem.channels.title} - ${result.error}`);
          
          // Send failure email
          if (queueItem.channels.users?.email) {
            await sendChannelProcessingNotification({
              userEmail: queueItem.channels.users.email,
              userName: extractUserNameFromEmail(queueItem.channels.users.email),
              channelTitle: queueItem.channels.title,
              channelUrl: `https://youtube.com/channel/${queueItem.channels.youtube_channel_id}`,
              videosProcessed: 0,
              status: 'failed',
              errorMessage: result.error
            }).catch(err => console.error('Failed to send email:', err));
          }
          
          processedChannels.push({
            channelId: queueItem.channel_id,
            title: queueItem.channels.title,
            videosProcessed: 0,
            status: 'failed',
            error: result.error
          });
        }
        
      } catch (error) {
        console.error(`❌ Error processing channel ${queueItem.channels.title}:`, error);
        
        // Mark as failed
        await supabaseAdmin
          .from('channel_queue')
          .update({ 
            status: 'failed', 
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', queueItem.id);
        
        await supabaseAdmin
          .from('channels')
          .update({ status: 'failed' })
          .eq('id', queueItem.channel_id);
        
        processedChannels.push({
          channelId: queueItem.channel_id,
          title: queueItem.channels.title,
          videosProcessed: 0,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    console.log(`🎯 Processed ${processedChannels.length} channels`);
    
    return {
      success: true,
      processed: processedChannels.length,
      channels: processedChannels
    };
    
  } catch (error) {
    console.error('❌ Channel queue processing error:', error);
    return {
      success: false,
      processed: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function processChannelVideos(channel: any, queueId: string): Promise<{ 
  success: boolean; 
  videosProcessed: number; 
  error?: string 
}> {
  try {
    const channelId = channel.youtube_channel_id;
    console.log(`📺 Fetching videos for channel: ${channelId}`);
    
    // Fetch videos from YouTube API
    const videos = await fetchAllChannelVideos(channelId);
    console.log(`📊 Found ${videos.length} videos in channel`);
    
    // Update total video count
    await supabaseAdmin
      .from('channel_queue')
      .update({ 
        total_videos: videos.length,
        estimated_completion_at: new Date(Date.now() + (videos.length * 15000)).toISOString()
      })
      .eq('id', queueId);
    
    await supabaseAdmin
      .from('channels')
      .update({ total_video_count: videos.length })
      .eq('id', channel.id);
    
    let processedCount = 0;
    
    // Process each video
    for (let index = 0; index < videos.length; index++) {
      const video = videos[index];
      try {
        console.log(`🎬 Processing video: ${video.snippet.title}`);
        
        // Check if video already exists
        const { data: existingVideo } = await supabaseAdmin
          .from('videos')
          .select('id')
          .eq('youtube_id', video.id.videoId)
          .single();
        
        if (existingVideo) {
          console.log(`⏭️  Video already exists: ${video.snippet.title}`);
          processedCount++;
          continue;
        }
        
        // Create video record
        const { data: videoRecord, error: videoError } = await supabaseAdmin
          .from('videos')
          .insert([{
            youtube_id: video.id.videoId,
            title: video.snippet.title,
            description: video.snippet.description || '',
            thumbnail_url: video.snippet.thumbnails?.medium?.url || '',
            duration: 0,
            channel_id: channel.id,
            transcript_cached: false
          }])
          .select()
          .single();
        
        if (videoError) {
          console.error(`❌ Error creating video record:`, videoError);
          continue;
        }
        
        // Process transcript directly
        const transcriptResult = await processVideoTranscript(video.id.videoId);
        
        if (transcriptResult.success) {
          console.log(`✅ Processed transcript: ${transcriptResult.chunkCount} chunks`);
          processedCount++;
        } else {
          console.error(`❌ Failed to process transcript: ${transcriptResult.error}`);
        }
        
        // Update progress
        await supabaseAdmin
          .from('channel_queue')
          .update({ 
            videos_processed: processedCount,
            current_video_index: index + 1,
            current_video_title: video.snippet.title,
            estimated_completion_at: new Date(Date.now() + ((videos.length - processedCount) * 15000)).toISOString()
          })
          .eq('id', queueId);
        
      } catch (error) {
        console.error(`❌ Error processing video ${video.snippet.title}:`, error);
      }
    }
    
    console.log(`✅ Completed: ${processedCount} videos processed out of ${videos.length}`);
    
    // If no videos were successfully processed, mark as failed
    if (processedCount === 0 && videos.length > 0) {
      return {
        success: false,
        videosProcessed: 0,
        error: 'Failed to process any videos. Transcripts may be unavailable.'
      };
    }
    
    return {
      success: true,
      videosProcessed: processedCount
    };
    
  } catch (error) {
    console.error('❌ Error processing channel videos:', error);
    return {
      success: false,
      videosProcessed: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function fetchAllChannelVideos(channelId: string) {
  console.log(`🎬 Fetching videos for channel: ${channelId}`);
  
  const videos: any[] = [];
  let nextPageToken = '';
  
  // TEST MODE: Only fetch last 3 videos
  const TEST_MODE = true;
  const TEST_VIDEO_LIMIT = 3;
  
  try {
    do {
      const url = `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${TEST_MODE ? TEST_VIDEO_LIMIT : 50}` +
        (nextPageToken ? `&pageToken=${nextPageToken}` : '') +
        `&key=${process.env.YOUTUBE_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ YouTube API Error:', data.error);
        throw new Error(`YouTube API error: ${data.error?.message || 'Unknown error'}`);
      }
      
      videos.push(...(data.items || []));
      nextPageToken = data.nextPageToken || '';
      
      console.log(`📄 Fetched ${data.items?.length || 0} videos (total: ${videos.length})`);
      
      // TEST MODE: Stop after fetching 3 videos
      if (TEST_MODE && videos.length >= TEST_VIDEO_LIMIT) {
        console.log(`🧪 TEST MODE: Limiting to ${TEST_VIDEO_LIMIT} videos`);
        return videos.slice(0, TEST_VIDEO_LIMIT);
      }
      
    } while (nextPageToken && (!TEST_MODE || videos.length < TEST_VIDEO_LIMIT));
    
    return TEST_MODE ? videos.slice(0, TEST_VIDEO_LIMIT) : videos;
    
  } catch (error) {
    console.error('❌ Error fetching channel videos:', error);
    throw error;
  }
}

function extractUserNameFromEmail(email: string): string {
  const name = email.split('@')[0];
  return name
    .split(/[._-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}