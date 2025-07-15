import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ensureUserExists } from '@/lib/user-sync';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get the Supabase user
    const user = await ensureUserExists();
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to sync user data' },
        { status: 500 }
      );
    }

    // Fetch recent chat sessions with video details
    const { data: sessions, error } = await supabaseAdmin
      .from('chat_sessions')
      .select(`
        id,
        video_id,
        created_at,
        updated_at,
        videos (
          id,
          title,
          thumbnail_url,
          youtube_id
        )
      `)
      .eq('user_id', user.id)
      .not('video_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching recent sessions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch recent sessions' },
        { status: 500 }
      );
    }

    // Get message counts for each session
    const sessionIds = sessions?.map(s => s.id) || [];
    const { data: messageCounts } = await supabaseAdmin
      .from('chat_messages')
      .select('session_id, id')
      .in('session_id', sessionIds);

    // Get last message for each session
    const { data: lastMessages } = await supabaseAdmin
      .from('chat_messages')
      .select('session_id, content, role')
      .in('session_id', sessionIds)
      .eq('role', 'user')
      .order('created_at', { ascending: false });

    // Create a map of session data
    const messageCountMap = new Map<string, number>();
    const lastMessageMap = new Map<string, string>();

    messageCounts?.forEach(msg => {
      const count = messageCountMap.get(msg.session_id) || 0;
      messageCountMap.set(msg.session_id, count + 1);
    });

    // Group last messages by session and take the most recent
    const lastMessageBySession = new Map<string, string>();
    lastMessages?.forEach(msg => {
      if (!lastMessageBySession.has(msg.session_id)) {
        lastMessageBySession.set(msg.session_id, msg.content);
      }
    });

    // Format the response
    const formattedSessions = sessions?.map(session => ({
      id: session.id,
      video_id: session.video_id,
      video_title: session.videos?.title || 'Untitled Video',
      video_thumbnail: session.videos?.thumbnail_url,
      video_youtube_id: session.videos?.youtube_id,
      created_at: session.created_at,
      updated_at: session.updated_at,
      message_count: messageCountMap.get(session.id) || 0,
      last_message: lastMessageBySession.get(session.id) || null
    })) || [];

    return NextResponse.json({
      success: true,
      sessions: formattedSessions
    });

  } catch (error) {
    console.error('Recent sessions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}