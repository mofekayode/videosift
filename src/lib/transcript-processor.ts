import { supabaseAdmin } from './supabase';
import { TranscriptSegment } from '@/types';
import { storeTranscriptInStorage } from './transcript-storage';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function processTranscriptWithChunks(
  videoId: string,
  segments: TranscriptSegment[]
) {
  try {
    // Check if video is already processed
    const { data: videos, error: videoError } = await supabaseAdmin
      .from('videos')
      .select('chunks_processed')
      .eq('id', videoId);
    
    if (videoError) {
      console.error('Error checking video status:', videoError);
    }
    
    const video = videos?.[0];
    
    if (video?.chunks_processed) {
      console.log('⚠️ Video already has chunks processed, checking chunk count...');
      const { count } = await supabaseAdmin
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('video_id', videoId);
      
      if (count && count > 0) {
        console.log(`✅ Found ${count} existing chunks, skipping processing`);
        return {
          success: true,
          chunkCount: count,
          skipped: true
        };
      }
    }
    
    // 1. Store transcript in Supabase Storage
    const { path, chunks } = await storeTranscriptInStorage(videoId, segments);
    
    // 2. Generate embeddings for each chunk
    const chunksWithEmbeddings = await Promise.all(
      chunks.map(async (chunk) => {
        // Get the actual text for this chunk
        const chunkSegments = segments.filter(
          seg => seg.start >= chunk.start_time && seg.end <= chunk.end_time
        );
        const chunkText = chunkSegments
          .map(seg => `[${formatTimestamp(seg.start)}] ${seg.text}`)
          .join('\n');
        
        // Generate embedding
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: chunkText,
        });
        
        return {
          ...chunk,
          embedding: embeddingResponse.data[0].embedding,
        };
      })
    );
    
    // 3. Store chunk metadata in database
    // First, delete existing chunks for this video to avoid duplicates
    const { error: deleteError } = await supabaseAdmin
      .from('transcript_chunks')
      .delete()
      .eq('video_id', videoId);
    
    if (deleteError) {
      console.warn('Failed to delete existing chunks:', deleteError.message);
    }
    
    // Then insert new chunks
    const { error: insertError } = await supabaseAdmin
      .from('transcript_chunks')
      .insert(
        chunksWithEmbeddings.map(chunk => ({
          video_id: videoId,
          chunk_index: chunk.chunk_index,
          start_time: chunk.start_time,
          end_time: chunk.end_time,
          storage_path: path,
          byte_offset: chunk.byte_offset,
          byte_length: chunk.byte_length,
          keywords: chunk.keywords,
          embedding: chunk.embedding,
        }))
      );
    
    if (insertError) {
      throw new Error(`Failed to store chunks: ${insertError.message}`);
    }
    
    // 4. Update video record
    const { error: updateError } = await supabaseAdmin
      .from('videos')
      .update({
        transcript_storage_path: path,
        chunks_processed: true,
        transcript_cached: true,
      })
      .eq('id', videoId);
    
    if (updateError) {
      throw new Error(`Failed to update video: ${updateError.message}`);
    }
    
    return {
      success: true,
      path,
      chunkCount: chunks.length,
    };
  } catch (error) {
    console.error('Error processing transcript:', error);
    throw error;
  }
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}