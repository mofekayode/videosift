import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ensureUserExists } from '@/lib/user-sync';
import { migrateAnonSessionsToUser } from '@/lib/migrate-sessions-server';

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the anonymous ID from request body or header
    const body = await request.json().catch(() => ({}));
    const anonId = body.anonId || request.headers.get('x-anon-id');

    if (!anonId) {
      return NextResponse.json({
        success: true,
        sessions_migrated: 0,
        messages_migrated: 0,
        message: 'No anonymous ID provided'
      });
    }

    // Ensure user exists in Supabase
    const user = await ensureUserExists();
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to create user record' },
        { status: 500 }
      );
    }

    // Perform migration
    const result = await migrateAnonSessionsToUser(user.id, anonId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Migration failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessions_migrated: result.sessions_migrated || 0,
      messages_migrated: result.messages_migrated || 0,
      message: result.sessions_migrated && result.sessions_migrated > 0
        ? `Successfully migrated ${result.sessions_migrated} session(s) with ${result.messages_migrated} message(s)`
        : 'No sessions to migrate'
    });

  } catch (error) {
    console.error('Migration API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}