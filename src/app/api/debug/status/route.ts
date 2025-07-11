import { NextRequest, NextResponse } from 'next/server';
import { getVideoByYouTubeId } from '@/lib/database';
import { extractVideoId } from '@/lib/youtube';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  
  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }
  
  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }
    
    // Check what's in the database
    const video = await getVideoByYouTubeId(videoId);
    
    // Get chunk count if video exists
    let chunkCount = 0;
    if (video) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { count } = await supabase
        .from('video_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('video_id', video.id);
      
      chunkCount = count || 0;
    }
    
    return NextResponse.json({
      success: true,
      videoId,
      video: video ? {
        id: video.id,
        youtube_id: video.youtube_id,
        title: video.title,
        duration: video.duration,
        transcript_cached: video.transcript_cached,
        created_at: video.created_at
      } : null,
      chunkCount,
      status: video 
        ? (video.transcript_cached ? 'ready' : 'metadata_only') 
        : 'not_processed'
    });
    
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}