import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ensureUserExists } from '@/lib/user-sync';
import { migrateAnonSessionToUser } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get request body for anonId
    const body = await request.json().catch(() => ({}));
    const { anonId } = body;

    console.log('🔄 Syncing user:', userId);
    const user = await ensureUserExists();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to sync user' },
        { status: 500 }
      );
    }

    // Migrate anonymous sessions if anonId is provided
    let migratedSessionsCount = 0;
    if (anonId) {
      console.log('🔄 Migrating anonymous sessions for anonId:', anonId);
      migratedSessionsCount = await migrateAnonSessionToUser(anonId, userId);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        clerkId: user.clerk_id,
        email: user.email,
        createdAt: user.created_at
      },
      migratedSessions: migratedSessionsCount
    });
  } catch (error) {
    console.error('❌ User sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}