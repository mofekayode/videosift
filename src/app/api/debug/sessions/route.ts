import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/user-sync';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    console.log('🔍 Debug sessions API called');
    console.log('Clerk userId:', userId);
    
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get ALL sessions for today
    const { data: allSessions, error: allError } = await supabase
      .from('chat_sessions')
      .select(`
        id,
        created_at,
        video_id,
        user_id,
        anon_id,
        chat_messages (
          id,
          content,
          role,
          created_at
        )
      `)
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())
      .order('created_at', { ascending: false });

    if (allError) {
      console.error('Error fetching all sessions:', allError);
    }

    const stats = {
      totalSessionsToday: allSessions?.length || 0,
      sessionsByUser: {},
      sessionsByAnon: {},
      totalMessages: 0,
      userMessages: 0
    };

    // Analyze sessions
    for (const session of allSessions || []) {
      const messages = session.chat_messages || [];
      const userMsgs = messages.filter(m => m.role === 'user');
      
      stats.totalMessages += messages.length;
      stats.userMessages += userMsgs.length;

      if (session.user_id) {
        if (!stats.sessionsByUser[session.user_id]) {
          stats.sessionsByUser[session.user_id] = {
            sessions: 0,
            messages: 0,
            userMessages: 0
          };
        }
        stats.sessionsByUser[session.user_id].sessions++;
        stats.sessionsByUser[session.user_id].messages += messages.length;
        stats.sessionsByUser[session.user_id].userMessages += userMsgs.length;
      }

      if (session.anon_id) {
        if (!stats.sessionsByAnon[session.anon_id]) {
          stats.sessionsByAnon[session.anon_id] = {
            sessions: 0,
            messages: 0,
            userMessages: 0
          };
        }
        stats.sessionsByAnon[session.anon_id].sessions++;
        stats.sessionsByAnon[session.anon_id].messages += messages.length;
        stats.sessionsByAnon[session.anon_id].userMessages += userMsgs.length;
      }
    }

    // Get current user's Supabase ID if logged in
    let currentUserSupabaseId = null;
    if (userId) {
      const user = await ensureUserExists();
      currentUserSupabaseId = user?.id;
    }

    return NextResponse.json({
      debug: true,
      currentUser: {
        clerkId: userId,
        supabaseId: currentUserSupabaseId
      },
      dateRange: {
        from: today.toISOString(),
        to: tomorrow.toISOString()
      },
      stats,
      recentSessions: allSessions?.slice(0, 5).map(s => ({
        id: s.id,
        created_at: s.created_at,
        user_id: s.user_id,
        anon_id: s.anon_id,
        messageCount: s.chat_messages?.length || 0,
        userMessageCount: s.chat_messages?.filter(m => m.role === 'user').length || 0,
        firstUserMessage: s.chat_messages?.find(m => m.role === 'user')?.content?.substring(0, 50) + '...'
      }))
    });
    
  } catch (error) {
    console.error('❌ Error in debug sessions API:', error);
    return NextResponse.json({ error: 'Failed to fetch debug data' }, { status: 500 });
  }
}