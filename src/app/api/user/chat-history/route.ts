import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserChatSessions } from '@/lib/database';
import { ensureUserExists } from '@/lib/user-sync';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get the Supabase user
    const user = await ensureUserExists();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('📋 Fetching chat history for user:', user.id);
    const sessions = await getUserChatSessions(user.id);
    
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