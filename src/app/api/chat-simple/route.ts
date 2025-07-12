import { NextRequest, NextResponse } from 'next/server';

// This endpoint now redirects all traffic to the streaming endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Forward the request to the streaming endpoint
    const streamingUrl = new URL('/api/chat-stream', request.url);
    
    const response = await fetch(streamingUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward any authentication headers
        ...Object.fromEntries(
          Array.from(request.headers.entries()).filter(([key]) => 
            key.toLowerCase().startsWith('authorization') || 
            key.toLowerCase().startsWith('x-')
          )
        ),
      },
      body: JSON.stringify(body),
    });
    
    // Return the streaming response
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    
  } catch (error) {
    console.error('Chat redirect error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}