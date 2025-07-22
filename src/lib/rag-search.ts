import { supabaseAdmin } from './supabase';
import { OpenAI } from 'openai';
import { getChunksFromStorage, streamChunksFromStorage } from './transcript-storage';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface RetrievedChunk {
  id: string;
  video_id: string;
  chunk_index: number;
  start_time: number;
  end_time: number;
  storage_path: string;
  byte_offset: number;
  byte_length: number;
  similarity?: number;
  text?: string;
  keywords: string[];
}

// Hybrid search combining semantic and keyword search
export async function hybridChunkSearch(
  videoId: string,
  youtubeId: string,
  query: string,
  topK: number = 5
): Promise<RetrievedChunk[]> {
  console.log(`🔍 Searching for: "${query}" in video ${videoId} (top ${topK} results)`);
  // 1. Generate query embedding
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: query,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;
  
  // 2. Extract keywords from query
  const queryKeywords = extractKeywords(query);
  
  // 3. Perform semantic search using direct query
  // Get ALL chunks for this video to calculate similarity
  const { data: allChunks, error: semanticError } = await supabaseAdmin
    .from('transcript_chunks')
    .select('*')
    .eq('video_id', videoId)
    .order('chunk_index');
  
  if (semanticError) {
    console.error('Semantic search error:', semanticError);
    throw new Error('Failed to search chunks');
  }
  
  // Calculate similarity scores for ALL chunks
  console.log(`📊 Calculating similarity for ${allChunks?.length || 0} chunks`);
  
  const resultsWithSimilarity = allChunks?.map(chunk => {
    // Simple cosine similarity calculation
    let similarity = 0;
    if (chunk.embedding && Array.isArray(chunk.embedding)) {
      const dotProduct = chunk.embedding.reduce((sum: number, val: number, idx: number) => 
        sum + (val * queryEmbedding[idx]), 0
      );
      const chunkMagnitude = Math.sqrt(chunk.embedding.reduce((sum: number, val: number) => 
        sum + (val * val), 0
      ));
      const queryMagnitude = Math.sqrt(queryEmbedding.reduce((sum, val) => 
        sum + (val * val), 0
      ));
      similarity = dotProduct / (chunkMagnitude * queryMagnitude);
    }
    return { ...chunk, similarity };
  }).sort((a, b) => b.similarity - a.similarity).slice(0, topK) || [];
  
  console.log(`🎯 Top semantic results (similarities): ${resultsWithSimilarity.slice(0, 3).map(r => r.similarity.toFixed(3)).join(', ')}`);
  
  // Log keywords for debugging
  console.log(`🔑 Query keywords: ${queryKeywords.join(', ')}`);
  
  // 4. Perform keyword search if we have keywords
  let keywordResults: any[] = [];
  if (queryKeywords.length > 0 && allChunks) {
    // Filter chunks that contain any of the query keywords
    // Note: We can't search full text here as it's not loaded yet from storage
    keywordResults = allChunks.filter(chunk => {
      if (!chunk.keywords || !Array.isArray(chunk.keywords)) return false;
      
      // Check if any query keyword matches any chunk keyword
      return queryKeywords.some(queryKeyword => 
        chunk.keywords.some((chunkKeyword: string) => 
          chunkKeyword.toLowerCase().includes(queryKeyword.toLowerCase()) ||
          queryKeyword.toLowerCase().includes(chunkKeyword.toLowerCase())
        )
      );
    });
  }
  
  // 5. Merge and deduplicate results
  const allResults = new Map<string, RetrievedChunk>();
  
  // Add semantic results
  resultsWithSimilarity?.forEach((result: any) => {
    allResults.set(result.id, {
      ...result,
      score: result.similarity
    });
  });
  
  // Add keyword results (boost score if already in semantic)
  keywordResults.forEach((result: any) => {
    if (allResults.has(result.id)) {
      const existing = allResults.get(result.id)!;
      existing.score = (existing.score || 0) + 0.3; // Boost hybrid matches
    } else {
      allResults.set(result.id, {
        ...result,
        score: 0.5 // Base score for keyword-only matches
      });
    }
  });
  
  // 6. Sort by score and return top K
  const sortedResults = Array.from(allResults.values())
    // No filtering based on time - important information can appear anywhere in the video
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, topK);
  
  // 7. Retrieve actual text for the chunks using YouTube ID
  let chunksWithText: string[];
  try {
    chunksWithText = await getChunksFromStorage(
      youtubeId,
      sortedResults.map(r => ({ 
        byte_offset: r.byte_offset, 
        byte_length: r.byte_length 
      }))
    );
  } catch (error) {
    console.error('Failed to get chunks from storage, falling back to database:', error);
    // Fallback: try to get chunks directly from database if storage fails
    const chunkIds = sortedResults.map(r => r.id);
    const { data: dbChunks } = await supabaseAdmin
      .from('video_chunks')
      .select('id, text')
      .in('id', chunkIds);
    
    if (!dbChunks || dbChunks.length === 0) {
      console.error('No chunks found in database either');
      return [];
    }
    
    // Map chunks back to original order
    const chunkTextMap = new Map(dbChunks.map(c => [c.id, c.text]));
    chunksWithText = sortedResults.map(r => chunkTextMap.get(r.id) || '');
  }
  
  return sortedResults.map((chunk, i) => ({
    ...chunk,
    text: chunksWithText[i]
  }));
}

// Stream chunks for real-time retrieval
export async function* streamRelevantChunks(
  videoId: string,
  youtubeId: string,
  query: string,
  topK: number = 5
) {
  // Get relevant chunks metadata
  const chunks = await hybridChunkSearch(videoId, youtubeId, query, topK);
  
  // Stream the actual text content using YouTube ID
  const chunkMetadata = chunks.map(c => ({
    byte_offset: c.byte_offset,
    byte_length: c.byte_length
  }));
  
  let index = 0;
  for await (const chunkText of streamChunksFromStorage(youtubeId, chunkMetadata)) {
    yield {
      ...chunks[index],
      text: chunkText
    };
    index++;
  }
}


function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'what', 'when', 'where', 'who', 'why', 'how', 'which', 'that', 'this'
  ]);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  // Get unique keywords
  return [...new Set(words)];
}