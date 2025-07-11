import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendChannelProcessingNotification } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    // This endpoint is for internal/cron job processing
    // In production, you'd want to authenticate this endpoint or call it from a secure environment
    
    console.log('🔄 Processing channel queue...');
    
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
      return NextResponse.json({ error: 'Failed to fetch queue items' }, { status: 500 });
    }
    
    if (!queueItems || queueItems.length === 0) {
      console.log('✅ No pending channels to process');
      return NextResponse.json({ message: 'No pending channels to process', processed: 0 });
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
        
        // Process the channel (fetch all videos and their transcripts)
        const result = await processChannelVideos(queueItem.channels);
        
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
              status: 'completed',
              video_count: result.videosProcessed,
              last_indexed_at: new Date().toISOString()
            })
            .eq('id', queueItem.channel_id);
          
          console.log(`✅ Completed channel: ${queueItem.channels.title} (${result.videosProcessed} videos)`);
          
          // Send success email notification
          if (queueItem.channels.users?.email) {
            try {
              await sendChannelProcessingNotification({
                userEmail: queueItem.channels.users.email,
                userName: extractUserNameFromEmail(queueItem.channels.users.email),
                channelTitle: queueItem.channels.title,
                channelUrl: `https://youtube.com/channel/${queueItem.channels.youtube_channel_id}`,
                videosProcessed: result.videosProcessed,
                status: 'completed'
              });
              console.log(`📧 Success email sent to ${queueItem.channels.users.email}`);
            } catch (emailError) {
              console.error('❌ Failed to send success email:', emailError);
            }
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
          
          // Send failure email notification
          if (queueItem.channels.users?.email) {
            try {
              await sendChannelProcessingNotification({
                userEmail: queueItem.channels.users.email,
                userName: extractUserNameFromEmail(queueItem.channels.users.email),
                channelTitle: queueItem.channels.title,
                channelUrl: `https://youtube.com/channel/${queueItem.channels.youtube_channel_id}`,
                videosProcessed: 0,
                status: 'failed',
                errorMessage: result.error
              });
              console.log(`📧 Failure email sent to ${queueItem.channels.users.email}`);
            } catch (emailError) {
              console.error('❌ Failed to send failure email:', emailError);
            }
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
        
        // Send failure email notification for unexpected errors
        if (queueItem.channels.users?.email) {
          try {
            await sendChannelProcessingNotification({
              userEmail: queueItem.channels.users.email,
              userName: extractUserNameFromEmail(queueItem.channels.users.email),
              channelTitle: queueItem.channels.title,
              channelUrl: `https://youtube.com/channel/${queueItem.channels.youtube_channel_id}`,
              videosProcessed: 0,
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            console.log(`📧 Error email sent to ${queueItem.channels.users.email}`);
          } catch (emailError) {
            console.error('❌ Failed to send error email:', emailError);
          }
        }
        
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
    
    return NextResponse.json({
      success: true,
      processed: processedChannels.length,
      channels: processedChannels
    });
    
  } catch (error) {
    console.error('❌ Channel queue processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processChannelVideos(channel: any): Promise<{ 
  success: boolean; 
  videosProcessed: number; 
  error?: string 
}> {
  try {
    const channelId = channel.youtube_channel_id;
    console.log(`📺 Fetching videos for channel: ${channelId}`);
    
    // Fetch all videos from the channel using YouTube API
    const videos = await fetchAllChannelVideos(channelId);
    console.log(`📊 Found ${videos.length} videos in channel`);
    
    let processedCount = 0;
    
    // Process each video
    for (const video of videos) {
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
            duration: 0, // We'll get this from video details if needed
            channel_id: channel.id,
            transcript_cached: false,
            published_at: video.snippet.publishedAt
          }])
          .select()
          .single();
        
        if (videoError) {
          console.error(`❌ Error creating video record for ${video.snippet.title}:`, videoError);
          continue;
        }
        
        // Download and process transcript
        const transcriptResult = await processVideoTranscript(video.id.videoId, videoRecord.id, channel.id);
        
        if (transcriptResult.success) {
          await supabaseAdmin
            .from('videos')
            .update({ transcript_cached: true })
            .eq('id', videoRecord.id);
          
          console.log(`✅ Processed transcript for: ${video.snippet.title}`);
        } else {
          console.log(`⚠️  No transcript available for: ${video.snippet.title}`);
        }
        
        processedCount++;
        
      } catch (error) {
        console.error(`❌ Error processing video ${video.snippet.title}:`, error);
        // Continue with next video
      }
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
  const videos: any[] = [];
  let nextPageToken = '';
  
  try {
    do {
      const url = `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&channelId=${channelId}&type=video&order=date&maxResults=50` +
        (nextPageToken ? `&pageToken=${nextPageToken}` : '') +
        `&key=${process.env.YOUTUBE_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${data.error?.message || 'Unknown error'}`);
      }
      
      videos.push(...(data.items || []));
      nextPageToken = data.nextPageToken || '';
      
      console.log(`📄 Fetched ${data.items?.length || 0} videos (total: ${videos.length})`);
      
      // Limit to prevent infinite loops and API quota issues
      if (videos.length >= 500) {
        console.log('⚠️  Reached video limit (500), stopping...');
        break;
      }
      
    } while (nextPageToken);
    
    return videos;
    
  } catch (error) {
    console.error('❌ Error fetching channel videos:', error);
    throw error;
  }
}

async function processVideoTranscript(videoId: string, dbVideoId: string, channelId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Use the existing transcript processing endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/video/transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    });
    
    if (response.ok) {
      return { success: true };
    } else {
      const error = await response.text();
      return { success: false, error };
    }
    
  } catch (error) {
    console.error('❌ Error processing transcript:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

function extractUserNameFromEmail(email: string): string {
  // Extract name from email (everything before @)
  // e.g., "john.doe@gmail.com" -> "John Doe"
  const name = email.split('@')[0];
  return name
    .split(/[._-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}