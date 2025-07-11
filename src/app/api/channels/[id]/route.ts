import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/user-sync';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    const channelId = params.id;
    
    // Fetch channel details with ownership check
    const { data: channel, error } = await supabase
      .from('channels')
      .select('*')
      .eq('id', channelId)
      .eq('owner_user_id', user.id)
      .single();
    
    if (error) {
      console.error('Error fetching channel:', error);
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      channel
    });
    
  } catch (error) {
    console.error('❌ Error fetching channel details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}