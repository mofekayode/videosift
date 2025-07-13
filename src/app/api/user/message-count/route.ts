import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/user-sync';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    // Get today's date range in UTC
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    if (!userId) {
      // For anonymous users, count by anon_id from localStorage
      const anonId = request.headers.get('x-anon-id');
      if (!anonId) {
        return NextResponse.json({
          count: 0,
          sessions: []
        });
      }

      // Get sessions for anonymous user
      const { data: sessions, error } = await supabase
        .from('chat_sessions')
        .select(`
          id,
          created_at,
          video_id,
          anon_id,
          user_id,
          chat_messages (
            id,
            content,
            role,
            created_at
          )
        `)
        .eq('anon_id', anonId)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())
        .order('created_at', { ascending: false });
      

      if (error) {
        console.error('Error fetching anon message count:', error);
        return NextResponse.json({
          count: 0,
          sessions: []
        });
      }

      // Count messages
      let totalCount = 0;
      for (const session of sessions || []) {
        totalCount += session.chat_messages?.filter(m => m.role === 'user').length || 0;
      }

      return NextResponse.json({
        count: totalCount,
        sessions: []
      });
    }

    // Get the Supabase user
    const user = await ensureUserExists();
    if (!user) {
      return NextResponse.json({
        count: 0,
        sessions: [],
        debug: { clerkId: userId, supabaseUser: null }
      });
    }

    // Get all sessions for today with message counts
    const { data: sessions, error } = await supabase
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
      .eq('user_id', user.id)
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())
      .order('created_at', { ascending: false });
      

    if (error) {
      console.error('Error fetching message count:', error);
      return NextResponse.json({
        count: 0,
        sessions: []
      });
    }

    // Count total USER messages across all sessions
    let totalCount = 0;
    const sessionSummaries = [];

    for (const session of sessions || []) {
      const userMessages = session.chat_messages?.filter(m => m.role === 'user') || [];
      const messageCount = userMessages.length;
      totalCount += messageCount;

      // Get first user message for session summary
      const firstMessage = session.chat_messages?.find(m => m.role === 'user');
      
      if (firstMessage) {
        sessionSummaries.push({
          id: session.id,
          firstMessage: firstMessage.content.substring(0, 100) + '...',
          messageCount,
          timestamp: session.created_at
        });
      }
    }


    return NextResponse.json({
      count: totalCount,
      sessions: sessionSummaries
    });
    
  } catch (error) {
    console.error('Error in message count API:', error);
    return NextResponse.json({
      count: 0,
      sessions: []
    });
  }
}