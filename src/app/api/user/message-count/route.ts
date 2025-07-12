import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/user-sync';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    console.log('🔍 Message count API called');
    console.log('Clerk userId:', userId);
    
    // Get today's date range in UTC
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    console.log('Date range (UTC):', today.toISOString(), 'to', tomorrow.toISOString());

    if (!userId) {
      // For anonymous users, count by anon_id from localStorage
      const anonId = request.headers.get('x-anon-id');
      console.log('👤 Anonymous user, anonId:', anonId);
      if (!anonId) {
        console.log('⚠️ No anonId provided');
        return NextResponse.json({
          count: 0,
          sessions: []
        });
      }

      // Get sessions for anonymous user
      console.log('🔎 Querying sessions for anon_id:', anonId);
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
      
      console.log('📊 Anonymous sessions found:', sessions?.length || 0);
      sessions?.forEach((s, i) => {
        console.log(`Session ${i}:`, {
          id: s.id,
          anon_id: s.anon_id,
          user_id: s.user_id,
          messages: s.chat_messages?.length || 0
        });
      });

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
    console.log('🔐 About to call ensureUserExists for Clerk ID:', userId);
    const user = await ensureUserExists();
    console.log('👤 Logged-in user, Supabase ID:', user?.id, 'Email:', user?.email);
    if (!user) {
      console.log('⚠️ Failed to get Supabase user');
      return NextResponse.json({
        count: 0,
        sessions: [],
        debug: { clerkId: userId, supabaseUser: null }
      });
    }

    // Get all sessions for today with message counts
    console.log('🔎 Querying sessions for user_id:', user.id);
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
      
    console.log('📊 User sessions found:', sessions?.length || 0);
    sessions?.forEach((s, i) => {
      console.log(`Session ${i}:`, {
        id: s.id,
        user_id: s.user_id,
        anon_id: s.anon_id,
        messages: s.chat_messages?.length || 0
      });
    });

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

    console.log(`📊 Total messages today for user ${user.id}: ${totalCount}`);
    console.log('📤 Returning count:', totalCount);

    return NextResponse.json({
      count: totalCount,
      sessions: sessionSummaries
    });
    
  } catch (error) {
    console.error('❌ Error in message count API:', error);
    return NextResponse.json({
      count: 0,
      sessions: []
    });
  }
}