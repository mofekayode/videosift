// Test script to check database connection and video existence
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Service Role Key exists:', !!supabaseKey);

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDatabase() {
  const videoId = 'dQw4w9WgXcQ';
  
  // Test 1: Check if videos table exists
  console.log('\n1. Checking videos table...');
  try {
    const { data: videos, error } = await supabase
      .from('videos')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('Error accessing videos table:', error);
    } else {
      console.log(`Found ${videos?.length || 0} videos in database`);
      if (videos && videos.length > 0) {
        console.log('Sample video:', videos[0]);
      }
    }
  } catch (error) {
    console.error('Database error:', error);
  }

  // Test 2: Check for specific video
  console.log(`\n2. Checking for video ${videoId}...`);
  try {
    const { data: video, error } = await supabase
      .from('videos')
      .select('*')
      .eq('youtube_id', videoId)
      .single();
    
    if (error) {
      console.error('Error finding video:', error);
    } else if (video) {
      console.log('Video found:', video);
    } else {
      console.log('Video not found in database');
    }
  } catch (error) {
    console.error('Database error:', error);
  }

  // Test 3: Check video chunks
  console.log(`\n3. Checking video chunks...`);
  try {
    const { data: chunks, error } = await supabase
      .from('video_chunks')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('Error accessing video_chunks table:', error);
    } else {
      console.log(`Found ${chunks?.length || 0} video chunks in database`);
    }
  } catch (error) {
    console.error('Database error:', error);
  }
}

testDatabase();