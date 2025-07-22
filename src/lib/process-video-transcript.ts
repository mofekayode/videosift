import { downloadTranscript } from '@/lib/transcript';
import { getVideoByYouTubeId, updateVideoTranscriptStatus } from '@/lib/database';
import { processTranscriptWithChunks } from '@/lib/transcript-processor';
import { DistributedLock } from '@/lib/distributed-lock';

// Keep in-memory lock as fallback for single instance
const processingVideos = new Set<string>();

export interface ProcessVideoResult {
  success: boolean;
  message?: string;
  error?: string;
  chunkCount?: number;
  cached?: boolean;
}

export async function processVideoTranscript(youtubeVideoId: string): Promise<ProcessVideoResult> {
  const startTime = Date.now();
  const timings: Record<string, number> = {};
  
  try {
    console.log('⚡ Processing transcript for video:', youtubeVideoId);
    
    if (!youtubeVideoId) {
      return {
        success: false,
        error: 'Video ID is required'
      };
    }
    
    // Get video from database
    const dbStart = Date.now();
    const video = await getVideoByYouTubeId(youtubeVideoId);
    timings.dbFetch = Date.now() - dbStart;
    
    if (!video) {
      console.log('❌ Video not found in database');
      return {
        success: false,
        error: 'Video not found in database'
      };
    }
    
    // Check if transcript is already processed with chunks
    if (video.transcript_cached && video.chunks_processed) {
      console.log('✅ Transcript already processed');
      return {
        success: true,
        message: 'Transcript already processed',
        cached: true
      };
    }
    
    // Try to acquire distributed lock first (for multi-instance deployments)
    const lockId = `video_${youtubeVideoId}`;
    const hasDistributedLock = await DistributedLock.acquire(lockId, 300); // 5 minute TTL
    
    if (!hasDistributedLock) {
      // Fallback to in-memory check for single instance
      if (processingVideos.has(youtubeVideoId)) {
        console.log('⚠️ Video is already being processed by another request');
        return {
          success: false,
          error: 'Video is already being processed'
        };
      }
    }
    
    // Add to in-memory set as additional protection
    processingVideos.add(youtubeVideoId);
    
    try {
      // If transcript is cached but not processed with chunks, re-process it
      if (video.transcript_cached && !video.chunks_processed) {
        console.log('⚠️ Legacy cached transcript without chunks, re-processing...');
      }
      
      // Download transcript with retry
      let segments;
      let downloadError;
      
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`📥 Downloading transcript (attempt ${attempt}/2)...`);
          segments = await downloadTranscript(youtubeVideoId);
          console.log(`📊 Downloaded ${segments.length} transcript segments`);
          break; // Success, exit loop
        } catch (error) {
          downloadError = error;
          console.error(`Attempt ${attempt} failed:`, error);
          
          if (attempt === 1) {
            // Wait a bit before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // If download failed after retries, return error
      if (!segments) {
        console.error('❌ Failed to download transcript after retries');
        return {
          success: false,
          error: downloadError instanceof Error ? downloadError.message : 'Failed to download transcript'
        };
      }
      
      // Process transcript with semantic chunking system
      try {
        console.log('🚀 Processing transcript with semantic chunks...');
        const result = await processTranscriptWithChunks(video.id, youtubeVideoId, segments);
        console.log(`✅ Processed ${result.chunkCount} chunks`);
        
        return {
          success: true,
          message: 'Transcript processed with semantic chunks',
          cached: true,
          chunkCount: result.chunkCount
        };
      } catch (chunkError) {
        console.error('Failed to process transcript chunks:', chunkError);
        return {
          success: false,
          error: chunkError instanceof Error ? chunkError.message : 'Failed to process transcript'
        };
      }
    } finally {
      // Always remove from processing set and release lock
      processingVideos.delete(youtubeVideoId);
      if (hasDistributedLock) {
        await DistributedLock.release(lockId);
      }
    }
    
  } catch (error) {
    console.error('❌ Transcript processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    };
  }
}