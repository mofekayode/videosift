import { NextRequest, NextResponse } from 'next/server';
import { getVideoMetadata } from '@/services/youtube';
import { extractVideoId } from '@/lib/youtube';
import { createVideo, getVideoByYouTubeId } from '@/lib/database';
import { CacheUtils } from '@/lib/cache';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const timings: Record<string, number> = {};
  
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
    const cacheStart = Date.now();
    const cachedMetadata = await CacheUtils.getCachedVideoMetadata(videoId);
    timings.cacheCheck = Date.now() - cacheStart;
    if (cachedMetadata) {
      console.log('🚀 Found cached metadata');
      const totalTime = Date.now() - startTime;
      console.log(`[METADATA API] Cache hit - Total: ${totalTime}ms (Cache check: ${timings.cacheCheck}ms)`);
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
    const dbStart = Date.now();
    let video = await getVideoByYouTubeId(videoId);
    timings.dbCheck = Date.now() - dbStart;
    console.log('🗃️ Video in database:', video ? 'Found' : 'Not found');
    
    if (!video) {
      // Fetch metadata from YouTube API
      console.log('📡 Fetching metadata from YouTube API...');
      const youtubeStart = Date.now();
      const metadata = await getVideoMetadata(videoId);
      timings.youtubeApi = Date.now() - youtubeStart;
      console.log('📊 Metadata result:', metadata ? 'Success' : 'Failed');
      
      if (!metadata) {
        console.log('❌ Video not found or unavailable');
        return NextResponse.json(
          { error: 'Video not found or unavailable' },
          { status: 404 }
        );
      }
      
      // Try to create video record in database
      const createStart = Date.now();
      video = await createVideo({
        youtube_id: metadata.id,
        title: metadata.title,
        description: metadata.description,
        duration: metadata.duration,
        thumbnail_url: metadata.thumbnail,
        channel_id: undefined, // Will be set if part of a channel
        transcript_cached: false
      });
      timings.dbCreate = Date.now() - createStart;
      
      if (!video) {
        // If creation failed, it might be due to a race condition
        // Try to fetch the video again
        console.log('⚠️ Video creation failed, checking if it was created by another request...');
        video = await getVideoByYouTubeId(videoId);
        
        if (!video) {
          return NextResponse.json(
            { error: 'Failed to create video record' },
            { status: 500 }
          );
        }
        console.log('✅ Found video created by another request');
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
    
    const cacheSetStart = Date.now();
    await CacheUtils.cacheVideoMetadata(videoId, resultData);
    timings.cacheSet = Date.now() - cacheSetStart;
    console.log('💾 Cached video metadata');
    
    const totalTime = Date.now() - startTime;
    console.log(`[METADATA API] Complete - Total: ${totalTime}ms`);
    console.log(`  - Cache check: ${timings.cacheCheck}ms`);
    console.log(`  - DB check: ${timings.dbCheck}ms`);
    if (timings.youtubeApi) console.log(`  - YouTube API: ${timings.youtubeApi}ms`);
    if (timings.dbCreate) console.log(`  - DB create: ${timings.dbCreate}ms`);
    console.log(`  - Cache set: ${timings.cacheSet}ms`);
    
    return NextResponse.json({
      success: true,
      cached: false,
      data: resultData,
      _performance: {
        total: totalTime,
        breakdown: timings
      }
    });
  } catch (error) {
    console.error('Video metadata API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}