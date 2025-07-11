import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    const { data, error } = await supabase
      .from('videos')
      .select('count')
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Database connection successful');
    
    return NextResponse.json({
      success: true,
      message: 'Database connection working',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'Missing',
      hasAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Present' : 'Missing',
      hasServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Present' : 'Missing'
    });
    
  } catch (error) {
    console.error('❌ Database connection error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'Missing',
      hasAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Present' : 'Missing',
      hasServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Present' : 'Missing'
    }, { status: 500 });
  }
}