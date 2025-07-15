import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hybridChunkSearch } from '@/lib/rag-search';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { channelId, searchQuery } = await request.json();
    
    if (!channelId) {
      return NextResponse.json(
        { error: 'Channel ID required' },
        { status: 400 }
      );
    }

    // Get all videos in the channel
    const { data: videos } = await supabaseAdmin
      .from('videos')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false });

    if (!videos || videos.length === 0) {
      return NextResponse.json({
        error: 'No videos found in channel'
      });
    }

    // Find videos with titles containing search terms
    const titleMatches = videos.filter(v => 
      v.title.toLowerCase().includes('hussein') || 
      v.title.toLowerCase().includes('farhat')
    );

    // If we have a search query, search within the Hussein Farhat video
    let searchResults = null;
    if (searchQuery && titleMatches.length > 0) {
      const husseinVideo = titleMatches[0];
      
      // Search this specific video
      const chunks = await hybridChunkSearch(husseinVideo.id, searchQuery, 10);
      searchResults = {
        videoId: husseinVideo.id,
        videoTitle: husseinVideo.title,
        chunks: chunks.map(c => ({
          text: c.text?.substring(0, 500) || 'No text',
          timestamp: c.timestamp,
          similarity: c.similarity
        }))
      };
    }

    // Get chunk count for each video
    const videoDetails = await Promise.all(videos.slice(0, 20).map(async (video) => {
      const { count } = await supabaseAdmin
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('video_id', video.id);
      
      return {
        id: video.id,
        title: video.title,
        youtube_id: video.youtube_id,
        chunks_processed: video.chunks_processed,
        transcript_cached: video.transcript_cached,
        chunk_count: count || 0,
        contains_hussein: video.title.toLowerCase().includes('hussein'),
        contains_farhat: video.title.toLowerCase().includes('farhat')
      };
    }));

    return NextResponse.json({
      channelId,
      totalVideos: videos.length,
      husseinFarhatVideos: titleMatches.map(v => ({
        id: v.id,
        title: v.title,
        youtube_id: v.youtube_id,
        chunks_processed: v.chunks_processed,
        transcript_cached: v.transcript_cached
      })),
      searchResults,
      first20Videos: videoDetails
    });

  } catch (error) {
    console.error('❌ Find video error:', error);
    
    return NextResponse.json(
      { 
        error: 'Find video failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}