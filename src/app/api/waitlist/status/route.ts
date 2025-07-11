import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

export async function GET(req: NextRequest) {
  try {
    const { userId } = auth();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email && !userId) {
      return NextResponse.json(
        { error: 'Email or user authentication required' },
        { status: 400 }
      );
    }

    // Check waitlist status
    let query = supabase.from('waitlist').select('position');
    
    if (userId) {
      query = query.or(`email.eq.${email || ''},user_id.eq.${userId}`);
    } else if (email) {
      query = query.eq('email', email);
    }

    const { data: waitlistEntry, error } = await query.single();

    if (error || !waitlistEntry) {
      return NextResponse.json({
        onWaitlist: false,
        position: null
      });
    }

    return NextResponse.json({
      onWaitlist: true,
      position: waitlistEntry.position
    });

  } catch (error) {
    console.error('Waitlist status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}