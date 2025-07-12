import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getVideoTranscript } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { videoId } = await request.json();
    
    // Test 1: Check if we can connect to Supabase
    let supabaseStatus = 'unknown';
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('id, youtube_id, title')
        .eq('youtube_id', videoId)
        .single();
        
      if (error) {
        supabaseStatus = `Error: ${error.message}`;
      } else if (data) {
        supabaseStatus = `Found video: ${data.title}`;
      } else {
        supabaseStatus = 'Video not found';
      }
    } catch (e) {
      supabaseStatus = `Exception: ${e}`;
    }
    
    // Test 2: Check if we can get transcript chunks
    let transcriptStatus = 'unknown';
    let chunkCount = 0;
    try {
      const chunks = await getVideoTranscript(videoId);
      chunkCount = chunks.length;
      transcriptStatus = `Found ${chunkCount} chunks`;
    } catch (e) {
      transcriptStatus = `Error: ${e}`;
    }
    
    // Test 3: Check environment variables
    const envStatus = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Set' : 'Missing',
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
      SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing',
    };
    
    // Test 4: Check rate_limits table
    let rateLimitsStatus = 'unknown';
    try {
      const { error } = await supabase
        .from('rate_limits')
        .select('id')
        .limit(1);
        
      if (error) {
        if (error.message.includes('relation "rate_limits" does not exist')) {
          rateLimitsStatus = 'Table does not exist - needs migration';
        } else {
          rateLimitsStatus = `Error: ${error.message}`;
        }
      } else {
        rateLimitsStatus = 'Table exists';
      }
    } catch (e) {
      rateLimitsStatus = `Exception: ${e}`;
    }
    
    return NextResponse.json({
      success: true,
      videoId,
      tests: {
        supabase: supabaseStatus,
        transcript: transcriptStatus,
        chunkCount,
        environment: envStatus,
        rateLimits: rateLimitsStatus
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}