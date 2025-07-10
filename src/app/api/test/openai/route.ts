import { NextResponse } from 'next/server';
import { testOpenAIConnection } from '@/lib/openai';

export async function GET() {
  try {
    const isConnected = await testOpenAIConnection();
    
    if (isConnected) {
      return NextResponse.json({
        success: true,
        message: 'OpenAI API connection successful'
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: 'OpenAI API connection failed' 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('OpenAI test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}