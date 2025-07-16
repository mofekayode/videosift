import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Debug: Manually triggering channel queue processing...');
    
    // Call the channel processing endpoint
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000');
    const response = await fetch(`${appUrl}/api/channel/process-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`Processing failed: ${result.error}`);
    }
    
    console.log(`✅ Debug: Processed ${result.processed} channels`);
    
    return NextResponse.json({
      success: true,
      message: 'Channel queue processing triggered manually',
      result
    });
    
  } catch (error) {
    console.error('❌ Debug processing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}