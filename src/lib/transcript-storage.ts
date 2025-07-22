import { supabaseAdmin } from './supabase';
import { TranscriptSegment } from '@/types';

interface ChunkMetadata {
  chunk_index: number;
  start_time: number;
  end_time: number;
  byte_offset: number;
  byte_length: number;
  keywords: string[];
}

// Store full transcript in Supabase Storage
export async function storeTranscriptInStorage(
  videoId: string,
  segments: TranscriptSegment[]
): Promise<{ path: string; chunks: ChunkMetadata[] }> {
  // Format transcript with clear chunk boundaries
  const { content, chunks } = formatTranscriptForStorage(segments);
  
  // Upload to Supabase Storage
  const path = `${videoId}/transcript.txt`;
  const { error } = await supabaseAdmin.storage
    .from('transcripts')
    .upload(path, content, {
      contentType: 'text/plain',
      upsert: true
    });
  
  if (error) {
    // If bucket doesn't exist, try to create it
    if (error.message?.includes('Bucket not found')) {
      console.log('Creating transcripts bucket...');
      const { error: createError } = await supabaseAdmin.storage.createBucket('transcripts', {
        public: false,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['text/plain']
      });
      
      if (!createError) {
        // Retry upload after creating bucket
        const { error: retryError } = await supabaseAdmin.storage
          .from('transcripts')
          .upload(path, content, {
            contentType: 'text/plain',
            upsert: true
          });
        
        if (!retryError) {
          return { path, chunks };
        }
      }
    }
    
    throw new Error(`Failed to upload transcript: ${error.message}`);
  }
  
  return { path, chunks };
}

// Format transcript with markers for easy chunk retrieval
function formatTranscriptForStorage(segments: TranscriptSegment[]) {
  const chunks: ChunkMetadata[] = [];
  let content = '';
  let byteOffset = 0;
  let chunkIndex = 0;
  let currentChunk = '';
  let chunkStartTime = 0;
  let chunkEndTime = 0;
  let chunkStartOffset = 0;
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const timestamp = formatTimestamp(segment.start);
    const line = `[${timestamp}] ${segment.text}\n`;
    
    // Start new chunk if needed
    if (currentChunk.length === 0) {
      chunkStartTime = segment.start;
      chunkStartOffset = byteOffset;
    }
    
    currentChunk += line;
    chunkEndTime = segment.end;
    
    // Check if we should end this chunk (natural boundary + size)
    const isNaturalBreak = segment.text.match(/[.!?]$/);
    const isLongEnough = currentChunk.length >= 1000; // Increase to 1000 chars for better context
    const isTooLong = currentChunk.length >= 2000; // Max 2000 chars
    const isLastSegment = i === segments.length - 1;
    
    if ((isNaturalBreak && isLongEnough) || isTooLong || isLastSegment) {
      // Save chunk metadata
      const chunkBytes = Buffer.from(currentChunk, 'utf-8');
      chunks.push({
        chunk_index: chunkIndex,
        start_time: chunkStartTime,
        end_time: chunkEndTime,
        byte_offset: chunkStartOffset,
        byte_length: chunkBytes.length,
        keywords: extractKeywords(currentChunk)
      });
      
      content += currentChunk;
      byteOffset += chunkBytes.length;
      chunkIndex++;
      currentChunk = '';
    }
  }
  
  return { content, chunks };
}

// Retrieve specific chunks from storage
export async function getChunksFromStorage(
  videoId: string,
  chunkMetadata: Array<{ byte_offset: number; byte_length: number }>
): Promise<string[]> {
  // Download the full transcript file
  const { data, error } = await supabaseAdmin.storage
    .from('transcripts')
    .download(`${videoId}/transcript.txt`);
  
  if (error || !data) {
    console.error('Transcript download error:', error);
    throw new Error(`Failed to download transcript: ${error?.message || error || 'No data returned'}`);
  }
  
  // Read as text
  const fullText = await data.text();
  const buffer = Buffer.from(fullText, 'utf-8');
  
  // Extract requested chunks
  return chunkMetadata.map(({ byte_offset, byte_length }) => {
    return buffer.toString('utf-8', byte_offset, byte_offset + byte_length);
  });
}

// Stream chunks for large transcripts
export async function* streamChunksFromStorage(
  videoId: string,
  chunkMetadata: Array<{ byte_offset: number; byte_length: number }>
) {
  const { data, error } = await supabaseAdmin.storage
    .from('transcripts')
    .download(`${videoId}/transcript.txt`);
  
  if (error || !data) {
    console.error('Transcript download error:', error);
    throw new Error(`Failed to download transcript: ${error?.message || error || 'No data returned'}`);
  }
  
  const reader = data.stream().getReader();
  let buffer = new Uint8Array(0);
  let position = 0;
  
  for (const chunk of chunkMetadata) {
    // Read until we have enough data
    while (position + buffer.length < chunk.byte_offset + chunk.byte_length) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Append to buffer
      const newBuffer = new Uint8Array(buffer.length + value.length);
      newBuffer.set(buffer);
      newBuffer.set(value, buffer.length);
      buffer = newBuffer;
    }
    
    // Extract chunk
    const start = chunk.byte_offset - position;
    const end = start + chunk.byte_length;
    const chunkData = buffer.slice(start, end);
    
    yield new TextDecoder().decode(chunkData);
    
    // Clean up buffer if it's getting too large
    if (buffer.length > 100000) {
      const keepFrom = Math.max(0, chunk.byte_offset + chunk.byte_length - position);
      buffer = buffer.slice(keepFrom);
      position += keepFrom;
    }
  }
  
  reader.releaseLock();
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been'
  ]);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  // Get unique keywords
  const wordSet = new Set(words);
  return Array.from(wordSet).slice(0, 10);
}