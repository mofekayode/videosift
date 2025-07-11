import { NextRequest, NextResponse } from 'next/server';
import { generateChatResponse, generateEmbedding, extractCitations } from '@/lib/openai';
import { searchVideoChunks, searchChannelChunks } from '@/lib/database';

// Simple in-memory cache for embeddings
const embeddingCache = new Map<string, { embedding: number[], timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const { query, videoId, channelId, messages = [] } = await request.json();
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    if (!videoId && !channelId) {
      return NextResponse.json(
        { error: 'Either videoId or channelId is required' },
        { status: 400 }
      );
    }
    
    // Check cache first for embedding
    const cacheKey = query.toLowerCase().trim();
    let embeddingResult;
    
    const cached = embeddingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('📦 Using cached embedding for query:', query);
      embeddingResult = { embedding: cached.embedding };
    } else {
      console.log('🔄 Generating new embedding for query:', query);
      embeddingResult = await generateEmbedding(query);
      
      if (!embeddingResult) {
        return NextResponse.json(
          { error: 'Failed to generate query embedding' },
          { status: 500 }
        );
      }
      
      // Cache the embedding
      embeddingCache.set(cacheKey, { 
        embedding: embeddingResult.embedding, 
        timestamp: Date.now() 
      });
    }
    
    // Search for relevant transcript chunks
    let chunks;
    console.log(`🔍 Searching for chunks with videoId: ${videoId}, channelId: ${channelId}`);
    
    if (videoId) {
      chunks = await searchVideoChunks(videoId, embeddingResult.embedding, 10); // Reduce chunks for speed
    } else {
      chunks = await searchChannelChunks(channelId!, embeddingResult.embedding, 10);
    }
    
    console.log(`📊 Found ${chunks.length} chunks for query: "${query}"`);
    
    if (chunks.length === 0) {
      console.log(`❌ No chunks found for videoId: ${videoId}`);
      return NextResponse.json({
        success: true,
        response: "I couldn't find any relevant information in the transcript to answer your question. Please try rephrasing your question or ask about something else from the video.",
        citations: []
      });
    }
    
    // Prepare transcript chunks for AI
    const transcriptChunks = chunks.map(chunk => ({
      text: chunk.text,
      start_sec: chunk.start_sec,
      end_sec: chunk.end_sec,
      video_title: undefined // TODO: Add video title if available
    }));
    
    // Generate AI response with faster model
    const response = await generateChatResponse(
      [
        ...messages,
        { role: 'user', content: query }
      ],
      transcriptChunks,
      'gpt-4o-mini' // Use mini version for speed
    );
    
    if (!response) {
      return NextResponse.json(
        { error: 'Failed to generate response' },
        { status: 500 }
      );
    }
    
    // Extract citations from response
    const citations = extractCitations(response);
    
    return NextResponse.json({
      success: true,
      response,
      citations: citations.map(citation => ({
        timestamp: citation.timestamp,
        text: findChunkByTimestamp(transcriptChunks, citation.timestamp)?.text || '',
        video_id: videoId || undefined
      })),
      chunks_used: chunks.length
    });
    
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to find chunk by timestamp
function findChunkByTimestamp(chunks: Array<{ start_sec: number; end_sec: number; text: string }>, timestamp: string) {
  // Parse timestamp to seconds
  const parts = timestamp.split(':').map(Number);
  let seconds = 0;
  
  if (parts.length === 2) {
    seconds = parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  
  // Find chunk that contains this timestamp
  return chunks.find(chunk => 
    seconds >= chunk.start_sec && seconds <= chunk.end_sec
  );
}