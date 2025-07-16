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
          owner_user_id
        ),
        users!channel_queue_requested_by_fkey (
          id,
          email,
          clerk_id
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
        // Check if channel exists (join might have failed)
        if (!queueItem.channels) {
          console.error(`❌ Channel not found for queue item ${queueItem.id}, channel_id: ${queueItem.channel_id}`);
          
          // Mark queue item as failed
          await supabaseAdmin
            .from('channel_queue')
            .update({ 
              status: 'failed', 
              completed_at: new Date().toISOString(),
              error_message: 'Channel not found in database'
            })
            .eq('id', queueItem.id);
          
          continue;
        }
        
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
          
          // Count actual videos linked to this channel
          const { count: actualVideoCount } = await supabaseAdmin
            .from('videos')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', queueItem.channel_id);
          
          await supabaseAdmin
            .from('channels')
            .update({ 
              status: 'ready',
              video_count: actualVideoCount || result.videosProcessed
            })
            .eq('id', queueItem.channel_id);
          
          console.log(`✅ Completed channel: ${queueItem.channels.title} (${result.videosProcessed} videos)`);
          
          // Debug user data
          console.log('📧 User data for email:', {
            hasUsers: !!queueItem.users,
            email: queueItem.users?.email,
            userId: queueItem.users?.id,
            requestedBy: queueItem.requested_by,
            channelOwnerId: queueItem.channels.owner_user_id
          });
          
          // Send success email to the user who requested the processing
          if (queueItem.users?.email) {
            await sendChannelProcessingNotification({
              userEmail: queueItem.users.email,
              userName: extractUserNameFromEmail(queueItem.users.email),
              channelTitle: queueItem.channels.title,
              channelUrl: `https://youtube.com/channel/${queueItem.channels.youtube_channel_id}`,
              videosProcessed: result.videosProcessed,
              totalVideos: result.totalVideos,
              existingVideos: result.existingVideos,
              noTranscriptVideos: result.noTranscriptVideos,
              failedVideos: result.failedVideos,
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
          
          // Send failure email to the user who requested the processing
          if (queueItem.users?.email) {
            await sendChannelProcessingNotification({
              userEmail: queueItem.users.email,
              userName: extractUserNameFromEmail(queueItem.users.email),
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
  totalVideos?: number;
  existingVideos?: number;
  noTranscriptVideos?: number;
  failedVideos?: number;
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
    let existingCount = 0;
    let failedCount = 0;
    let noTranscriptCount = 0;
    
    // Process videos in batches for better performance
    const BATCH_SIZE = 3; // Process 3 videos concurrently
    
    for (let i = 0; i < videos.length; i += BATCH_SIZE) {
      const batch = videos.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(async (video, batchIndex) => {
          const index = i + batchIndex;
          try {
            console.log(`🎬 Processing video: ${video.snippet.title}`);
            
            // Check if video already exists
            const { data: existingVideo } = await supabaseAdmin
              .from('videos')
              .select('id, channel_id, transcript_cached')
              .eq('youtube_id', video.id.videoId)
              .single();
            
            if (existingVideo) {
              console.log(`⏭️  Video already exists: ${video.snippet.title}`);
              
              // Link video to channel if not already linked
              if (existingVideo.channel_id !== channel.id) {
                await supabaseAdmin
                  .from('videos')
                  .update({ channel_id: channel.id })
                  .eq('id', existingVideo.id);
                console.log(`🔗 Linked existing video to channel`);
              }
              
              // Return counts for aggregation
              return {
                existed: true,
                processed: existingVideo.transcript_cached,
                noTranscript: !existingVideo.transcript_cached
              };
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
              return { failed: true };
            }
            
            // Process transcript directly
            const transcriptResult = await processVideoTranscript(video.id.videoId);
            
            if (transcriptResult.success) {
              console.log(`✅ Processed transcript: ${transcriptResult.chunkCount} chunks`);
              return { processed: true };
            } else {
              console.error(`❌ Failed to process transcript: ${transcriptResult.error}`);
              if (transcriptResult.error?.includes('No transcript available') || 
                  transcriptResult.error?.includes('No captions found')) {
                return { noTranscript: true };
              } else {
                return { failed: true };
              }
            }
          } catch (error) {
            console.error(`❌ Error processing video ${video.snippet.title}:`, error);
            return { failed: true };
          }
        })
      );
      
      // Aggregate batch results
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const value = result.value;
          if (value.existed) existingCount++;
          if (value.processed) processedCount++;
          if (value.noTranscript) noTranscriptCount++;
          if (value.failed) failedCount++;
        } else {
          failedCount++;
        }
      });
      
      // Update progress after each batch
      await supabaseAdmin
        .from('channel_queue')
        .update({ 
          videos_processed: processedCount,
          current_video_index: Math.min(i + BATCH_SIZE, videos.length),
          current_video_title: batch[batch.length - 1]?.snippet.title || '',
          estimated_completion_at: new Date(Date.now() + ((videos.length - processedCount) * 5000)).toISOString()
        })
        .eq('id', queueId);
    }
    
    console.log(`✅ Completed: ${processedCount} videos processed out of ${videos.length}`);
    console.log(`📊 Stats: ${existingCount} existing, ${noTranscriptCount} no transcript, ${failedCount} failed`);
    console.log(`🔍 Breakdown: Total=${videos.length}, Processed=${processedCount}, Existing=${existingCount}, NoTranscript=${noTranscriptCount}, Failed=${failedCount}`);
    
    // If no videos were successfully processed, mark as failed
    if (processedCount === 0 && videos.length > 0) {
      return {
        success: false,
        videosProcessed: 0,
        totalVideos: videos.length,
        existingVideos: existingCount,
        noTranscriptVideos: noTranscriptCount,
        failedVideos: failedCount,
        error: 'Failed to process any videos. Transcripts may be unavailable.'
      };
    }
    
    return {
      success: true,
      videosProcessed: processedCount,
      totalVideos: videos.length,
      existingVideos: existingCount,
      noTranscriptVideos: noTranscriptCount,
      failedVideos: failedCount
    };
    
  } catch (error) {
    console.error('❌ Error processing channel videos:', error);
    return {
      success: false,
      videosProcessed: 0,
      totalVideos: 0,
      existingVideos: 0,
      noTranscriptVideos: 0,
      failedVideos: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function fetchAllChannelVideos(channelId: string) {
  console.log(`🎬 Fetching videos for channel: ${channelId}`);
  
  const videos: any[] = [];
  let nextPageToken = '';
  
  // TEST MODE: Only fetch last 20 videos
  const TEST_MODE = true;
  const TEST_VIDEO_LIMIT = 20;
  
  try {
    do {
      // Use playlistItems API to get ALL videos from the uploads playlist
      // First, get the uploads playlist ID if we haven't already
      let uploadsPlaylistId = channelId.replace('UC', 'UU'); // YouTube convention: UC -> UU for uploads playlist
      
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?` +
        `part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${TEST_MODE ? 10 : 50}` +
        (nextPageToken ? `&pageToken=${nextPageToken}` : '') +
        `&key=${process.env.YOUTUBE_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ YouTube API Error:', data.error);
        throw new Error(`YouTube API error: ${data.error?.message || 'Unknown error'}`);
      }
      
      // Transform playlist items to match search API format
      const transformedVideos = (data.items || []).map((item: any) => ({
        id: { videoId: item.snippet.resourceId.videoId },
        snippet: item.snippet
      }));
      videos.push(...transformedVideos);
      nextPageToken = data.nextPageToken || '';
      
      console.log(`📄 Page ${videos.length === 0 ? '1' : Math.ceil(videos.length / 10) + 1}: Fetched ${data.items?.length || 0} videos, Total: ${videos.length}, Has more: ${!!data.nextPageToken}`);
      
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