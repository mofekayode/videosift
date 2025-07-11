import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ensureUserExists } from '@/lib/user-sync';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    console.log('🔄 Syncing user:', userId);
    const user = await ensureUserExists();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to sync user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        clerkId: user.clerk_id,
        email: user.email,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('❌ User sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}