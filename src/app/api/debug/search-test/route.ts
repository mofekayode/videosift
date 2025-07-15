import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { channelId, searchTerm } = await request.json();
    
    if (!channelId || !searchTerm) {
      return NextResponse.json(
        { error: 'Channel ID and search term required' },
        { status: 400 }
      );
    }

    // Get all videos in the channel
    const { data: videos } = await supabaseAdmin
      .from('videos')
      .select('id, title, youtube_id')
      .eq('channel_id', channelId);

    if (!videos || videos.length === 0) {
      return NextResponse.json({
        error: 'No videos found in channel'
      });
    }

    // Search for the term in all video transcripts
    const searchResults = [];
    
    for (const video of videos) {
      // Get all chunks for this video
      const { data: chunks } = await supabaseAdmin
        .from('transcript_chunks')
        .select('chunk_index, text, keywords, start_time, end_time')
        .eq('video_id', video.id)
        .order('chunk_index');
      
      if (!chunks) continue;
      
      // Search for the term in each chunk
      const matches = chunks.filter(chunk => {
        const textMatch = chunk.text.toLowerCase().includes(searchTerm.toLowerCase());
        const keywordMatch = chunk.keywords?.some(k => 
          k.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return textMatch || keywordMatch;
      });
      
      if (matches.length > 0) {
        searchResults.push({
          video: {
            id: video.id,
            title: video.title,
            youtube_id: video.youtube_id
          },
          matches: matches.map(m => ({
            chunk_index: m.chunk_index,
            text_preview: m.text.substring(0, 200) + '...',
            keywords: m.keywords,
            timestamp: `${m.start_time} - ${m.end_time}`,
            contains_search_term: m.text.toLowerCase().includes(searchTerm.toLowerCase())
          }))
        });
      }
    }

    return NextResponse.json({
      searchTerm,
      channelId,
      totalVideos: videos.length,
      videosWithMatches: searchResults.length,
      results: searchResults
    });

  } catch (error) {
    console.error('❌ Search test error:', error);
    
    return NextResponse.json(
      { 
        error: 'Search test failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}