import { TranscriptSegment } from '@/types';
import crypto from 'crypto';

export interface TranscriptChunk {
  chunk_index: number;
  start_time: number;
  end_time: number;
  text: string;
  text_hash: string;
  has_complete_thought: boolean;
  entities: string[];
  keywords: string[];
  context_before?: string;
  context_after?: string;
}

// Create semantic chunks with proper boundaries
export function createSemanticChunks(
  segments: TranscriptSegment[],
  options = {
    targetChunkSize: 300, // characters
    maxChunkSize: 500,
    contextWindowSize: 100
  }
): TranscriptChunk[] {
  const chunks: TranscriptChunk[] = [];
  let currentChunk: TranscriptSegment[] = [];
  let currentLength = 0;
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentLength = segment.text.length;
    
    // Check if adding this segment would exceed max size
    if (currentLength + segmentLength > options.maxChunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push(createChunkFromSegments(currentChunk, chunks.length));
      currentChunk = [segment];
      currentLength = segmentLength;
      continue;
    }
    
    currentChunk.push(segment);
    currentLength += segmentLength;
    
    // Check for natural break points
    const isNaturalBreak = 
      segment.text.endsWith('.') || 
      segment.text.endsWith('?') || 
      segment.text.endsWith('!') ||
      segment.text.endsWith(':');
    
    const isLongEnough = currentLength >= options.targetChunkSize;
    
    // Create chunk at natural boundaries
    if (isNaturalBreak && isLongEnough) {
      chunks.push(createChunkFromSegments(currentChunk, chunks.length));
      currentChunk = [];
      currentLength = 0;
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(createChunkFromSegments(currentChunk, chunks.length));
  }
  
  // Add context windows
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      chunks[i].context_before = chunks[i - 1].text.slice(-options.contextWindowSize);
    }
    if (i < chunks.length - 1) {
      chunks[i].context_after = chunks[i + 1].text.slice(0, options.contextWindowSize);
    }
  }
  
  return chunks;
}

function createChunkFromSegments(
  segments: TranscriptSegment[],
  index: number
): TranscriptChunk {
  const text = segments.map(s => s.text).join(' ').trim();
  const startTime = segments[0].start;
  const endTime = segments[segments.length - 1].end;
  
  return {
    chunk_index: index,
    start_time: startTime,
    end_time: endTime,
    text,
    text_hash: crypto.createHash('sha256').update(text).digest('hex'),
    has_complete_thought: checkCompleteThought(text),
    entities: extractEntities(text),
    keywords: extractKeywords(text),
  };
}

// Check if text contains a complete thought
function checkCompleteThought(text: string): boolean {
  // Simple heuristic: ends with punctuation and has subject-verb structure
  const endsWithPunctuation = /[.!?]$/.test(text.trim());
  const hasMinimumWords = text.split(/\s+/).length >= 5;
  
  return endsWithPunctuation && hasMinimumWords;
}

// Extract named entities (simple version - you could use NLP library)
function extractEntities(text: string): string[] {
  const entities: string[] = [];
  
  // Extract capitalized words (potential proper nouns)
  const properNouns = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
  entities.push(...properNouns);
  
  // Extract numbers with units
  const measurements = text.match(/\d+\s*(?:seconds?|minutes?|hours?|%|percent)/gi) || [];
  entities.push(...measurements);
  
  // Remove duplicates and common words
  const commonWords = ['The', 'This', 'That', 'These', 'Those', 'A', 'An'];
  return [...new Set(entities)]
    .filter(e => !commonWords.includes(e))
    .slice(0, 10); // Limit to 10 entities
}

// Extract important keywords (simple version)
function extractKeywords(text: string): string[] {
  // Remove common stop words and extract important terms
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall',
    'it', 'its', 'they', 'them', 'their', 'this', 'that', 'these', 'those'
  ]);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  // Count word frequency
  const wordFreq = new Map<string, number>();
  words.forEach(word => {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  });
  
  // Get top keywords by frequency
  return Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

// Prepare chunks for database insertion
export function prepareChunksForDB(
  chunks: TranscriptChunk[],
  videoId: string
) {
  return chunks.map(chunk => ({
    video_id: videoId,
    ...chunk,
    // Embedding will be added separately after generation
    embedding: null
  }));
}