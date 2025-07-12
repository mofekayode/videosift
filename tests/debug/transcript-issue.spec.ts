import { test } from '@playwright/test';

test.describe('Debug Transcript Download Issue', () => {
  test('Check transcript download functionality', async () => {
    // Direct test of the transcript module
    const { downloadTranscript } = await import('../../src/lib/transcript');
    
    console.log('Testing transcript download with various videos...\n');
    
    const testCases = [
      { id: 'jNQXAC9IVRw', name: 'Me at the zoo (short, should have captions)' },
      { id: 'dQw4w9WgXcQ', name: 'Rick Astley (music video, should have captions)' },
      { id: 'BHO_glbVcIg', name: 'Philosophy video (from your DB)' },
    ];
    
    for (const testCase of testCases) {
      console.log(`\nTesting: ${testCase.name}`);
      console.log(`Video ID: ${testCase.id}`);
      
      try {
        const segments = await downloadTranscript(testCase.id);
        console.log(`✅ Success! Downloaded ${segments.length} segments`);
        console.log(`   First segment: "${segments[0]?.text?.substring(0, 50)}..."`);
        console.log(`   Duration: ${segments[0]?.start}s - ${segments[segments.length-1]?.end}s`);
      } catch (error: any) {
        console.error(`❌ Failed to download transcript`);
        console.error(`   Error: ${error.message}`);
        
        // Detailed error analysis
        if (error.message?.includes('No transcript available')) {
          console.error('   → Video may not have captions enabled');
          console.error('   → Or the video might be private/deleted');
        } else if (error.message?.includes('fetch')) {
          console.error('   → Network error - check internet connection');
          console.error('   → Or YouTube might be blocking requests');
        } else if (error.message?.includes('ENOTFOUND')) {
          console.error('   → DNS resolution failed - network issue');
        }
      }
    }
    
    // Test with the specific video that's failing
    console.log('\n\n🔍 Detailed test with problematic video:');
    try {
      // Use dynamic import to test the actual module
      const YoutubeTranscriptApi = (await import('youtube-transcript-api')).default;
      
      console.log('Module loaded successfully');
      console.log('Available methods:', Object.keys(YoutubeTranscriptApi));
      
      // Try direct API call
      const problemVideoId = 'YOUR_FAILING_VIDEO_ID'; // Replace with actual failing ID
      console.log(`\nTrying direct API call for: ${problemVideoId}`);
      
      const transcript = await YoutubeTranscriptApi.getTranscript(problemVideoId);
      console.log('Direct API call succeeded!', transcript.length, 'segments');
    } catch (error: any) {
      console.error('Direct API call failed:', error.message);
      console.error('Full error:', error);
    }
  });
  
  test('Check network connectivity', async () => {
    console.log('\n🌐 Checking network connectivity...');
    
    try {
      const response = await fetch('https://www.youtube.com');
      console.log('✅ YouTube is reachable:', response.status);
    } catch (error) {
      console.error('❌ Cannot reach YouTube:', error);
    }
    
    try {
      const response = await fetch('https://www.google.com');
      console.log('✅ Internet connection is working:', response.status);
    } catch (error) {
      console.error('❌ No internet connection:', error);
    }
  });
});