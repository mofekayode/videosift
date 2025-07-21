import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hybridChunkSearch } from '@/lib/rag-search';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channelId, searchQuery } = await request.json();

    if (!channelId || !searchQuery) {
      return NextResponse.json(
        { error: 'channelId and searchQuery are required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Debug search for "${searchQuery}" in channel ${channelId}`);

    // 1. Get all videos in the channel
    const { data: videos, error: videosError } = await supabaseAdmin
      .from('videos')
      .select('id, youtube_id, title, duration, created_at')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false });

    if (videosError) {
      console.error('Error fetching videos:', videosError);
      return NextResponse.json(
        { error: 'Failed to fetch videos', details: videosError },
        { status: 500 }
      );
    }

    console.log(`📹 Found ${videos?.length || 0} videos in channel`);

    // 2. Check which video titles contain the search query
    const searchTerms = searchQuery.toLowerCase().split(' ');
    const videosWithMatchingTitles = videos?.filter(video => {
      const titleLower = video.title.toLowerCase();
      return searchTerms.some(term => titleLower.includes(term));
    }) || [];

    console.log(`📌 ${videosWithMatchingTitles.length} videos have matching titles`);

    // 3. For each video, check if it has chunks and search them
    const searchResults = await Promise.all(
      (videos || []).map(async (video) => {
        try {
          // Check if video has chunks
          const { data: chunkCount, error: countError } = await supabaseAdmin
            .from('transcript_chunks')
            .select('id', { count: 'exact', head: true })
            .eq('video_id', video.id);

          if (countError) {
            console.error(`Error counting chunks for video ${video.id}:`, countError);
            return {
              video,
              error: 'Failed to count chunks',
              chunkCount: 0,
              searchResults: []
            };
          }

          const totalChunks = chunkCount?.length || 0;
          console.log(`📊 Video "${video.title}" has ${totalChunks} chunks`);

          if (totalChunks === 0) {
            return {
              video,
              chunkCount: 0,
              searchResults: [],
              message: 'No chunks indexed for this video'
            };
          }

          // Perform hybrid search
          const searchResults = await hybridChunkSearch(video.id, video.youtube_id, searchQuery, 10);
          
          // Get a sample of the actual text content for the top results
          const topResultsWithText = searchResults.slice(0, 3).map(chunk => ({
            chunkIndex: chunk.chunk_index,
            startTime: chunk.start_time,
            endTime: chunk.end_time,
            similarity: chunk.similarity,
            keywords: chunk.keywords,
            textPreview: chunk.text ? chunk.text.substring(0, 200) + '...' : 'No text available'
          }));

          return {
            video,
            chunkCount: totalChunks,
            searchResultCount: searchResults.length,
            topResults: topResultsWithText,
            titleContainsQuery: searchTerms.some(term => video.title.toLowerCase().includes(term))
          };
        } catch (error) {
          console.error(`Error searching video ${video.id}:`, error);
          return {
            video,
            error: error instanceof Error ? error.message : 'Unknown error',
            chunkCount: 0,
            searchResults: []
          };
        }
      })
    );

    // 4. Analyze the results
    const analysis = {
      totalVideos: videos?.length || 0,
      videosWithMatchingTitles: videosWithMatchingTitles.map(v => ({
        id: v.id,
        title: v.title,
        youtube_id: v.youtube_id
      })),
      videosWithChunks: searchResults.filter(r => r.chunkCount > 0).length,
      videosWithSearchResults: searchResults.filter(r => r.searchResultCount > 0).length,
      searchQuery,
      searchTerms
    };

    // 5. Find the specific video mentioned in the query
    const targetVideoTitle = "Hussein Farhat's Bloodwork Just Changed Everything";
    const targetVideo = videos?.find(v => v.title === targetVideoTitle);
    const targetVideoResults = targetVideo 
      ? searchResults.find(r => r.video.id === targetVideo.id)
      : null;

    return NextResponse.json({
      success: true,
      analysis,
      targetVideo: targetVideo ? {
        found: true,
        video: targetVideo,
        results: targetVideoResults
      } : {
        found: false,
        message: `Video "${targetVideoTitle}" not found in channel`
      },
      allResults: searchResults,
      debug: {
        channelId,
        searchQuery,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in channel search debug:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Channel Search Debug Endpoint',
    usage: 'POST with { channelId: string, searchQuery: string }',
    purpose: 'Debug why search queries are not finding the expected videos',
    features: [
      'Lists all videos in the channel',
      'Shows which videos have matching titles',
      'Performs hybrid search on each video',
      'Shows chunk counts and search results',
      'Specifically looks for "Hussein Farhat\'s Bloodwork Just Changed Everything"'
    ]
  });
}