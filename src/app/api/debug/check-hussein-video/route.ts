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

    const { channelId, videoTitle = "Hussein Farhat's Bloodwork Just Changed Everything" } = await request.json();
    
    if (!channelId) {
      return NextResponse.json(
        { error: 'Channel ID required' },
        { status: 400 }
      );
    }

    console.log('🔍 Looking for video:', videoTitle);

    // Step 1: Find the video
    const { data: video, error: videoError } = await supabaseAdmin
      .from('videos')
      .select('*')
      .eq('channel_id', channelId)
      .ilike('title', `%${videoTitle}%`)
      .single();

    if (videoError || !video) {
      return NextResponse.json({
        error: 'Video not found',
        searchedTitle: videoTitle,
        channelId
      });
    }

    console.log('✅ Found video:', video.title, 'ID:', video.id);

    // Step 2: Check chunks
    const { count: chunkCount } = await supabaseAdmin
      .from('transcript_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('video_id', video.id);

    console.log('📊 Video has', chunkCount, 'chunks');

    // Step 3: Test search with various queries
    const testQueries = [
      'Hussein Farhat',
      'Hussein',
      'Farhat',
      'bloodwork',
      'natty'
    ];

    const searchResults: any = {};

    for (const query of testQueries) {
      console.log(`🔍 Testing search for: "${query}"`);
      const chunks = await hybridChunkSearch(video.id, query, 5);
      
      searchResults[query] = {
        found: chunks.length,
        topResult: chunks[0] ? {
          text: chunks[0].text?.substring(0, 200) || 'No text',
          similarity: chunks[0].similarity,
          keywords: chunks[0].keywords
        } : null
      };
    }

    // Step 4: Get sample chunks to see what's indexed
    const { data: sampleChunks } = await supabaseAdmin
      .from('transcript_chunks')
      .select('chunk_index, text, keywords')
      .eq('video_id', video.id)
      .order('chunk_index')
      .limit(5);

    return NextResponse.json({
      video: {
        id: video.id,
        title: video.title,
        youtube_id: video.youtube_id,
        chunks_processed: video.chunks_processed,
        transcript_cached: video.transcript_cached,
        created_at: video.created_at
      },
      chunkCount,
      searchResults,
      sampleChunks: sampleChunks?.map(c => ({
        index: c.chunk_index,
        textPreview: c.text.substring(0, 150) + '...',
        keywords: c.keywords?.slice(0, 5)
      }))
    });

  } catch (error) {
    console.error('❌ Check Hussein video error:', error);
    
    return NextResponse.json(
      { 
        error: 'Check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}