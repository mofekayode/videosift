import { NextRequest, NextResponse } from 'next/server';
import { generateEmbedding } from '@/lib/openai';
import { getVideoChunks, updateVideoChunkEmbedding } from '@/lib/database';

// Background processing of embeddings for existing transcript chunks
export async function POST(request: NextRequest) {
  try {
    const { videoId } = await request.json();
    console.log('🧠 Background embedding processing for video:', videoId);
    
    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }
    
    // Get chunks that don't have embeddings yet
    const chunks = await getVideoChunks(videoId);
    const chunksNeedingEmbeddings = chunks.filter(chunk => !chunk.embedding);
    
    console.log(`🔄 Processing embeddings for ${chunksNeedingEmbeddings.length} chunks`);
    
    // Process embeddings in batches for better performance
    const batchSize = 5;
    for (let i = 0; i < chunksNeedingEmbeddings.length; i += batchSize) {
      const batch = chunksNeedingEmbeddings.slice(i, i + batchSize);
      
      // Process batch in parallel
      const embeddingPromises = batch.map(async (chunk) => {
        try {
          const embeddingResult = await generateEmbedding(chunk.text);
          if (embeddingResult) {
            await updateVideoChunkEmbedding(chunk.id, embeddingResult.embedding);
            console.log(`✅ Updated embedding for chunk ${chunk.id}`);
          }
        } catch (error) {
          console.error(`❌ Failed to process embedding for chunk ${chunk.id}:`, error);
        }
      });
      
      await Promise.all(embeddingPromises);
      console.log(`📦 Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunksNeedingEmbeddings.length / batchSize)}`);
    }
    
    console.log(`✅ Background embedding processing completed for video: ${videoId}`);
    
    return NextResponse.json({
      success: true,
      message: `Processed embeddings for ${chunksNeedingEmbeddings.length} chunks`,
      processed: chunksNeedingEmbeddings.length
    });
    
  } catch (error) {
    console.error('❌ Background embedding processing error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}