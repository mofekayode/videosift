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

      // Get messages for anonymous user
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select(`
          id,
          content,
          role,
          created_at,
          session_id,
          chat_sessions!inner (
            id,
            anon_id,
            video_id
          )
        `)
        .eq('chat_sessions.anon_id', anonId)
        .eq('role', 'user')
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

      return NextResponse.json({
        count: messages?.length || 0,
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

    // Get all messages for today (not sessions created today)
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select(`
        id,
        content,
        role,
        created_at,
        session_id,
        chat_sessions!inner (
          id,
          user_id,
          video_id
        )
      `)
      .eq('chat_sessions.user_id', user.id)
      .eq('role', 'user')
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

    // Count is simply the number of user messages today
    const totalCount = messages?.length || 0;
    
    // Group messages by session for summary
    const sessionMap = new Map();
    for (const msg of messages || []) {
      const sessionId = msg.session_id;
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, []);
      }
      sessionMap.get(sessionId).push(msg);
    }
    
    const sessionSummaries = Array.from(sessionMap.entries()).map(([sessionId, msgs]) => ({
      id: sessionId,
      firstMessage: msgs[msgs.length - 1].content.substring(0, 100) + '...', // Oldest message first
      messageCount: msgs.length,
      timestamp: msgs[msgs.length - 1].created_at
    }));


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