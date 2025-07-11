import { NextRequest, NextResponse } from 'next/server';
import { generateChatResponse, extractCitations } from '@/lib/openai';
import { getVideoTranscript } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { query, videoId, messages = [] } = await request.json();
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }
    
    console.log(`🔍 Getting transcript for videoId: ${videoId}`);
    
    // Get all transcript chunks for this video (no embedding search needed)
    const chunks = await getVideoTranscript(videoId);
    
    console.log(`📊 Found ${chunks.length} transcript chunks for query: "${query}"`);
    
    if (chunks.length === 0) {
      return NextResponse.json({
        success: true,
        response: "I couldn't find the transcript for this video. The video may not have captions available.",
        citations: []
      });
    }
    
    // Prepare transcript chunks for AI (sorted by timestamp)
    const transcriptChunks = chunks
      .sort((a, b) => a.start_sec - b.start_sec)
      .map(chunk => ({
        text: chunk.text,
        start_sec: chunk.start_sec,
        end_sec: chunk.end_sec,
      }));
    
    // Generate AI response with the full transcript
    const response = await generateChatResponse(
      [
        ...messages,
        { role: 'user', content: query }
      ],
      transcriptChunks,
      'gpt-4o-mini'
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
        video_id: videoId
      })),
      chunks_used: chunks.length
    });
    
  } catch (error) {
    console.error('Simple chat API error:', error);
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