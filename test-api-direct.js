// Direct API test to simulate browser request
const videoId = 'BHO_glbVcIg'; // A video that exists in the database

async function testChatDirect() {
  console.log('Testing chat API directly...\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/chat-simple', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'What is this video about?',
        videoId: videoId,
        messages: []
      })
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('\nResponse body:');
    
    if (text) {
      try {
        const data = JSON.parse(text);
        console.log(JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('Raw text:', text);
      }
    } else {
      console.log('Empty response body');
    }
    
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testChatDirect();