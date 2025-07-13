const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testVideoTranscripts() {
  const videos = [
    { id: 'clsM-qJlY0c', title: 'Data Analyst Interview' },
    { id: 'AT1XH0C87sU', title: 'Best Tech Company' },
    { id: 'pbHxIpo0mkw', title: 'Dropbox Interview' }
  ];
  
  console.log('Testing transcript availability for Exponent videos:\n');
  
  for (const video of videos) {
    console.log(`\nTesting: ${video.title} (${video.id})`);
    
    try {
      const response = await fetch('http://localhost:3001/api/video/transcript-quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id })
      });
      
      const data = await response.json();
      console.log(`Status: ${response.status}`);
      console.log(`Result:`, data);
      
      if (data.success) {
        console.log(`✅ Success! ${data.chunkCount || 0} chunks created`);
      } else {
        console.log(`❌ Failed: ${data.error}`);
      }
    } catch (error) {
      console.error(`Error:`, error.message);
    }
  }
}

testVideoTranscripts();