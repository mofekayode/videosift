import { NextRequest, NextResponse } from 'next/server';
import { getVideoMetadata } from '@/services/youtube';
import { extractVideoId } from '@/lib/youtube';
import { createVideo, getVideoByYouTubeId } from '@/lib/database';
import { CacheUtils } from '@/lib/cache';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    console.log('🔍 Processing video metadata request for URL:', url);
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }
    
    const videoId = extractVideoId(url);
    console.log('📺 Extracted video ID:', videoId);
    
    if (!videoId) {
      console.log('❌ Invalid YouTube URL:', url);
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }
    
    // Check cache first
    const cachedMetadata = await CacheUtils.getCachedVideoMetadata(videoId);
    if (cachedMetadata) {
      console.log('🚀 Found cached metadata');
      return NextResponse.json({
        success: true,
        cached: true,
        data: {
          video: cachedMetadata.video,
          metadata: {
            youtube_id: cachedMetadata.video.youtube_id,
            title: cachedMetadata.video.title,
            duration: cachedMetadata.video.duration,
            thumbnail_url: cachedMetadata.video.thumbnail_url
          }
        }
      });
    }

    // Check if video already exists in database
    let video = await getVideoByYouTubeId(videoId);
    console.log('🗃️ Video in database:', video ? 'Found' : 'Not found');
    
    if (!video) {
      // Fetch metadata from YouTube API
      console.log('📡 Fetching metadata from YouTube API...');
      const metadata = await getVideoMetadata(videoId);
      console.log('📊 Metadata result:', metadata ? 'Success' : 'Failed');
      
      if (!metadata) {
        console.log('❌ Video not found or unavailable');
        return NextResponse.json(
          { error: 'Video not found or unavailable' },
          { status: 404 }
        );
      }
      
      // Create video record in database
      video = await createVideo({
        youtube_id: metadata.id,
        title: metadata.title,
        description: metadata.description,
        duration: metadata.duration,
        thumbnail_url: metadata.thumbnail,
        channel_id: undefined, // Will be set if part of a channel
        transcript_cached: false
      });
      
      if (!video) {
        return NextResponse.json(
          { error: 'Failed to create video record' },
          { status: 500 }
        );
      }
    }
    
    // Cache the result for future requests
    const resultData = {
      video,
      metadata: {
        youtube_id: video.youtube_id,
        title: video.title,
        duration: video.duration,
        thumbnail_url: video.thumbnail_url
      }
    };
    
    await CacheUtils.cacheVideoMetadata(videoId, resultData);
    console.log('💾 Cached video metadata');
    
    return NextResponse.json({
      success: true,
      cached: false,
      data: resultData
    });
  } catch (error) {
    console.error('Video metadata API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}