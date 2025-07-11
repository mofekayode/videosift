import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserChatSessions } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    console.log('📋 Fetching chat history for user:', userId);
    const sessions = await getUserChatSessions(userId);
    
    console.log(`✅ Found ${sessions.length} chat sessions for user`);
    
    return NextResponse.json({
      success: true,
      sessions
    });
    
  } catch (error) {
    console.error('❌ Error fetching chat history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}