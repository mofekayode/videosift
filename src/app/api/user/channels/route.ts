import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserChannels } from '@/lib/database';
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

    // Ensure user exists in Supabase and get the Supabase user record
    const user = await ensureUserExists();
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to sync user data' },
        { status: 500 }
      );
    }

    console.log('📋 Fetching channels for user:', user.id);
    const channels = await getUserChannels(user.id);
    
    console.log(`✅ Found ${channels.length} channels for user`);
    
    return NextResponse.json({
      success: true,
      channels
    });
    
  } catch (error) {
    console.error('❌ Error fetching user channels:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}