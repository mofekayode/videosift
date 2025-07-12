import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/user-sync';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({
        success: true,
        activities: [] // Return empty for anonymous users
      });
    }

    // Get the Supabase user
    const user = await ensureUserExists();
    if (!user) {
      return NextResponse.json({
        success: true,
        activities: []
      });
    }

    console.log('📋 Fetching recent activity for user:', user.id);
    
    // Get recent activities
    const activities = [];
    
    // Get recent chat sessions
    const { data: chatSessions } = await supabase
      .from('chat_sessions')
      .select('id, created_at, video_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (chatSessions) {
      for (const session of chatSessions) {
        activities.push({
          id: `chat-${session.id}`,
          type: 'chat',
          title: 'Started a new chat session',
          created_at: session.created_at
        });
      }
    }
    
    // Get recent channel processing
    const { data: channels } = await supabase
      .from('channels')
      .select('id, created_at, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(2);
    
    if (channels) {
      for (const channel of channels) {
        activities.push({
          id: `channel-${channel.id}`,
          type: 'channel',
          title: `Indexed channel: ${channel.name}`,
          created_at: channel.created_at
        });
      }
    }
    
    // Sort activities by date
    activities.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    // Limit to 5 most recent
    const recentActivities = activities.slice(0, 5);
    
    console.log(`✅ Found ${recentActivities.length} recent activities`);
    
    return NextResponse.json({
      success: true,
      activities: recentActivities
    });
    
  } catch (error) {
    console.error('❌ Error fetching recent activity:', error);
    return NextResponse.json({
      success: true,
      activities: [] // Return empty on error
    });
  }
}