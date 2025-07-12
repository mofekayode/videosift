import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/user-sync';

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    const clerkUser = await currentUser();
    
    console.log('Debug my messages - Clerk ID:', clerkUserId);
    console.log('Debug my messages - Clerk user email:', clerkUser?.emailAddresses[0]?.emailAddress);
    
    // Get the Supabase user
    const supabaseUser = await ensureUserExists();
    console.log('Debug my messages - Supabase user:', supabaseUser?.id, supabaseUser?.email);
    
    // Get today's date range in UTC
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    
    // Try different queries
    const queries = [];
    
    // 1. Query by Supabase user ID
    if (supabaseUser) {
      const { data: sessionsByUserId, error: error1 } = await supabase
        .from('chat_sessions')
        .select(`
          id,
          created_at,
          user_id,
          anon_id,
          chat_messages (
            id,
            role,
            content
          )
        `)
        .eq('user_id', supabaseUser.id)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());
      
      queries.push({
        method: 'By Supabase user_id',
        userId: supabaseUser.id,
        sessions: sessionsByUserId?.length || 0,
        messages: sessionsByUserId?.reduce((acc, s) => acc + (s.chat_messages?.filter(m => m.role === 'user').length || 0), 0) || 0,
        error: error1
      });
    }
    
    // 2. Query by email (if user table has sessions)
    if (clerkUser?.emailAddresses[0]?.emailAddress) {
      const { data: userByEmail } = await supabase
        .from('users')
        .select('id')
        .eq('email', clerkUser.emailAddresses[0].emailAddress)
        .single();
      
      if (userByEmail) {
        const { data: sessionsByEmail, error: error2 } = await supabase
          .from('chat_sessions')
          .select(`
            id,
            user_id,
            chat_messages (
              role
            )
          `)
          .eq('user_id', userByEmail.id)
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString());
        
        queries.push({
          method: 'By email lookup',
          userId: userByEmail.id,
          sessions: sessionsByEmail?.length || 0,
          messages: sessionsByEmail?.reduce((acc, s) => acc + (s.chat_messages?.filter(m => m.role === 'user').length || 0), 0) || 0,
          error: error2
        });
      }
    }
    
    // 3. Get ALL sessions for today to see what's there
    const { data: allSessions } = await supabase
      .from('chat_sessions')
      .select('user_id, anon_id')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());
    
    const uniqueUserIds = [...new Set(allSessions?.map(s => s.user_id).filter(Boolean) || [])];
    const uniqueAnonIds = [...new Set(allSessions?.map(s => s.anon_id).filter(Boolean) || [])];
    
    return NextResponse.json({
      clerk: {
        userId: clerkUserId,
        email: clerkUser?.emailAddresses[0]?.emailAddress
      },
      supabase: {
        userId: supabaseUser?.id,
        email: supabaseUser?.email,
        clerkId: supabaseUser?.clerk_id
      },
      dateRange: {
        from: today.toISOString(),
        to: tomorrow.toISOString()
      },
      queries,
      todayStats: {
        totalSessions: allSessions?.length || 0,
        uniqueUserIds,
        uniqueAnonIds
      }
    });
    
  } catch (error) {
    console.error('Error in debug my messages:', error);
    return NextResponse.json({ error: 'Failed to debug messages' }, { status: 500 });
  }
}