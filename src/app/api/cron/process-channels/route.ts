import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // This endpoint can be called by a cron job service like Vercel Cron or external cron
    // For security, you might want to add authorization headers in production
    
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;
    
    // Simple auth check (optional, for production)
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('🔄 Cron job: Starting channel processing...');
    
    // Call the channel processing endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/channel/process-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`Processing failed: ${result.error}`);
    }
    
    console.log(`✅ Cron job completed: Processed ${result.processed} channels`);
    
    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} channels`,
      details: result
    });
    
  } catch (error) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}