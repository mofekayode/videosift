import { NextRequest, NextResponse } from 'next/server';
import { generateChatResponse, generateEmbedding, extractCitations } from '@/lib/openai';
import { searchVideoChunks, searchChannelChunks } from '@/lib/database';

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
    
    // Generate embedding for the query
    const embeddingResult = await generateEmbedding(query);
    
    if (!embeddingResult) {
      return NextResponse.json(
        { error: 'Failed to generate query embedding' },
        { status: 500 }
      );
    }
    
    // Search for relevant transcript chunks
    let chunks;
    if (videoId) {
      chunks = await searchVideoChunks(videoId, embeddingResult.embedding, 20);
    } else {
      chunks = await searchChannelChunks(channelId!, embeddingResult.embedding, 20);
    }
    
    if (chunks.length === 0) {
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
    
    // Generate AI response
    const response = await generateChatResponse(
      [
        ...messages,
        { role: 'user', content: query }
      ],
      transcriptChunks,
      videoId ? 'gpt-4o' : 'gpt-3.5-turbo' // Use GPT-3.5 for channels to reduce cost
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