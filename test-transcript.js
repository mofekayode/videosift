const YoutubeTranscriptApi = require('youtube-transcript-api');

async function testTranscript() {
  try {
    console.log('Testing transcript download...');
    const transcript = await YoutubeTranscriptApi.getTranscript('BHO_glbVcIg');
    console.log('Success!', transcript.length, 'segments');
    console.log('First few segments:', transcript.slice(0, 3));
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  }
}

testTranscript();