import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    const { email } = await req.json();

    console.log('Waitlist join request:', { email, userId });

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user is already on waitlist
    const { data: existingEntry, error: checkError } = await supabase
      .from('waitlist')
      .select('position')
      .or(`email.eq.${email},user_id.eq.${userId || 'null'}`)
      .single();

    console.log('Existing entry check:', { existingEntry, checkError });

    if (existingEntry) {
      return NextResponse.json({
        success: true,
        position: existingEntry.position,
        message: 'Already on waitlist'
      });
    }

    // Add to waitlist
    const { data: newEntry, error: insertError } = await supabase
      .from('waitlist')
      .insert({
        email,
        user_id: userId || null
      })
      .select('position')
      .single();

    console.log('Insert result:', { newEntry, insertError });

    if (insertError) {
      console.error('Error adding to waitlist:', insertError);
      return NextResponse.json(
        { error: 'Failed to join waitlist', details: insertError.message },
        { status: 500 }
      );
    }

    console.log('Successfully added to waitlist:', newEntry);

    return NextResponse.json({
      success: true,
      position: newEntry.position,
      message: 'Successfully joined waitlist'
    });

  } catch (error) {
    console.error('Waitlist join error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}