import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if supabaseAdmin is available (it will be null in environments without the service role key)
    if (!supabaseAdmin) {
      console.log('⚠️ Supabase admin client not available - skipping cron job');
      return NextResponse.json({ message: 'Supabase admin client not available', error: 'Missing service role key' }, { status: 503 });
    }
    
    console.log('🔄 Cron job: Checking for new videos in indexed channels...');
    
    // Get all completed channels
    const { data: channels, error: channelsError } = await supabaseAdmin
      .from('channels')
      .select('id, youtube_channel_id, title, last_indexed_at')
      .eq('status', 'completed')
      .order('last_indexed_at', { ascending: true })
      .limit(10); // Process 10 channels at a time
    
    if (channelsError) {
      throw new Error(`Failed to fetch channels: ${channelsError.message}`);
    }
    
    if (!channels || channels.length === 0) {
      console.log('✅ No channels to check for new videos');
      return NextResponse.json({ message: 'No channels to check', processed: 0 });
    }
    
    console.log(`📋 Checking ${channels.length} channels for new videos`);
    
    const results = [];
    
    for (const channel of channels) {
      try {
        console.log(`🔍 Checking channel: ${channel.title}`);
        
        // Get the latest video date from our database
        const { data: latestVideo } = await supabaseAdmin
          .from('videos')
          .select('published_at')
          .eq('channel_id', channel.id)
          .order('published_at', { ascending: false })
          .limit(1)
          .single();
        
        const lastVideoDate = latestVideo?.published_at || channel.last_indexed_at;
        
        // Fetch recent videos from YouTube API
        const youtubeResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/search?` +
          `part=snippet&channelId=${channel.youtube_channel_id}&type=video&order=date&maxResults=10` +
          `&publishedAfter=${new Date(lastVideoDate).toISOString()}` +
          `&key=${process.env.YOUTUBE_API_KEY}`
        );
        
        if (!youtubeResponse.ok) {
          throw new Error(`YouTube API error: ${youtubeResponse.statusText}`);
        }
        
        const youtubeData = await youtubeResponse.json();
        const newVideos = youtubeData.items || [];
        
        console.log(`📺 Found ${newVideos.length} new videos for ${channel.title}`);
        
        let processedCount = 0;
        
        // Process each new video
        for (const video of newVideos) {
          try {
            // Check if video already exists
            const { data: existingVideo } = await supabaseAdmin
              .from('videos')
              .select('id')
              .eq('youtube_id', video.id.videoId)
              .single();
            
            if (existingVideo) {
              console.log(`⏭️  Video already exists: ${video.snippet.title}`);
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
                transcript_cached: false,
                published_at: video.snippet.publishedAt
              }])
              .select()
              .single();
            
            if (videoError) {
              console.error(`❌ Error creating video record for ${video.snippet.title}:`, videoError);
              continue;
            }
            
            // Download and process transcript in background
            try {
              const transcriptResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/video/transcript`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId: video.id.videoId }),
              });
              
              if (transcriptResponse.ok) {
                await supabaseAdmin
                  .from('videos')
                  .update({ transcript_cached: true })
                  .eq('id', videoRecord.id);
                
                console.log(`✅ Processed new video: ${video.snippet.title}`);
              } else {
                console.log(`⚠️  No transcript available for: ${video.snippet.title}`);
              }
            } catch (transcriptError) {
              console.error(`❌ Error processing transcript for ${video.snippet.title}:`, transcriptError);
            }
            
            processedCount++;
            
          } catch (error) {
            console.error(`❌ Error processing video ${video.snippet.title}:`, error);
            continue;
          }
        }
        
        // Update channel's last_indexed_at timestamp
        await supabaseAdmin
          .from('channels')
          .update({ last_indexed_at: new Date().toISOString() })
          .eq('id', channel.id);
        
        results.push({
          channelId: channel.id,
          channelTitle: channel.title,
          newVideosFound: newVideos.length,
          videosProcessed: processedCount
        });
        
      } catch (error) {
        console.error(`❌ Error checking channel ${channel.title}:`, error);
        results.push({
          channelId: channel.id,
          channelTitle: channel.title,
          newVideosFound: 0,
          videosProcessed: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    const totalProcessed = results.reduce((sum, r) => sum + (r.videosProcessed || 0), 0);
    console.log(`✅ Cron job completed: Processed ${totalProcessed} new videos across ${results.length} channels`);
    
    return NextResponse.json({
      success: true,
      message: `Checked ${results.length} channels, processed ${totalProcessed} new videos`,
      results
    });
    
  } catch (error) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}